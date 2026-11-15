<?php

namespace Tests\Feature\Results;

use App\Enums\EventStatus;
use App\Events\PublicResultsChanged;
use App\Models\Event;
use App\Models\User;
use App\Services\EvaluationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event as EventFacade;
use Tests\Concerns\CreatesForms;
use Tests\Concerns\CreatesScoringFixtures;
use Tests\TestCase;

class RevealTest extends TestCase
{
    use RefreshDatabase, CreatesForms, CreatesScoringFixtures;

    private function actor(User $user): static
    {
        return $this->spa()->actingAs($user, 'sanctum');
    }

    /** @return array{0: Event, 1: User} Participants 1 to 4 score 90, 80, 80 and 70: ranks 1, 2, 2, 4. */
    private function finished(): array
    {
        [$event, $version, $people, $judges, $admin] = $this->scoringEvent(4, 1, [100]);
        foreach ([90, 80, 80, 70] as $i => $score) {
            app(EvaluationService::class)->submit($event, $people[$i], $judges[0], $this->scoreMap($version, [$score]), $judges[0]);
        }
        $event->forceFill(['status' => EventStatus::Completed])->save();

        return [$event, $admin];
    }

    private function publish(Event $event, User $admin, array $extra = []): void
    {
        $this->actor($admin)->postJson("/api/v1/events/{$event->id}/results/publish", array_merge(['visibility' => 'rank_and_score', 'confirm' => true], $extra))->assertCreated();
    }

    private function act(Event $event, User $admin, string $action)
    {
        return $this->actor($admin)->postJson("/api/v1/events/{$event->id}/reveal", ['action' => $action]);
    }

    /** @return list<string> */
    private function publicNumbers(Event $event): array
    {
        return array_column($this->getJson("/api/v1/public/events/{$event->code}/results")->assertOk()->json('data.rows'), 'number');
    }

    public function test_without_reveal_everything_is_public(): void
    {
        [$event, $admin] = $this->finished();
        $this->publish($event, $admin);

        $this->assertSame(['1', '2', '3', '4'], $this->publicNumbers($event));
        $this->getJson("/api/v1/public/events/{$event->code}/results")->assertJsonPath('data.reveal', null);
    }

    public function test_the_server_never_sends_unrevealed_rows(): void
    {
        [$event, $admin] = $this->finished();
        $this->publish($event, $admin, ['reveal' => true]);

        $response = $this->getJson("/api/v1/public/events/{$event->code}/results")->assertOk()
            ->assertJsonPath('data.reveal.enabled', true)
            ->assertJsonPath('data.reveal.total_steps', 2)
            ->assertJsonPath('data.reveal.revealed_steps', 0)
            ->assertJsonPath('data.reveal.complete', false);

        $this->assertSame(['4'], array_column($response->json('data.rows'), 'number'));
        $this->assertStringNotContainsString('90.00', $response->getContent());
        $this->assertStringNotContainsString('80.00', $response->getContent());
    }

    public function test_steps_reveal_ties_together_and_stop_at_the_end(): void
    {
        [$event, $admin] = $this->finished();
        $this->publish($event, $admin, ['reveal' => true]);

        $this->act($event, $admin, 'next')->assertOk()->assertJsonPath('data.revealed_steps', 1);
        $this->assertSame(['2', '3', '4'], $this->publicNumbers($event));

        $this->act($event, $admin, 'next')->assertOk()->assertJsonPath('data.complete', true);
        $this->assertSame(['1', '2', '3', '4'], $this->publicNumbers($event));

        $this->act($event, $admin, 'next')->assertUnprocessable()->assertJsonValidationErrors('reveal');
    }

    public function test_undo_all_and_reset(): void
    {
        [$event, $admin] = $this->finished();
        $this->publish($event, $admin, ['reveal' => true]);

        $this->act($event, $admin, 'undo')->assertUnprocessable()->assertJsonValidationErrors('reveal');

        $this->act($event, $admin, 'all')->assertOk();
        $this->assertSame(['1', '2', '3', '4'], $this->publicNumbers($event));

        $this->act($event, $admin, 'undo')->assertOk();
        $this->assertSame(['2', '3', '4'], $this->publicNumbers($event));

        $this->act($event, $admin, 'reset')->assertOk();
        $this->assertSame(['4'], $this->publicNumbers($event));
    }

    public function test_the_number_of_hidden_places_is_configurable(): void
    {
        [$event, $admin] = $this->finished();
        $this->publish($event, $admin, ['reveal' => true, 'reveal_top' => 1]);

        $this->getJson("/api/v1/public/events/{$event->code}/results")->assertJsonPath('data.reveal.total_steps', 1);
        $this->assertSame(['2', '3', '4'], $this->publicNumbers($event));

        $this->actor($admin)->postJson("/api/v1/events/{$event->id}/results/unpublish")->assertForbidden();
    }

    public function test_the_presenter_sees_every_step_but_the_public_does_not(): void
    {
        [$event, $admin] = $this->finished();
        $this->publish($event, $admin, ['reveal' => true]);

        $this->actor($admin)->getJson("/api/v1/events/{$event->id}/reveal")->assertOk()
            ->assertJsonCount(2, 'data.steps')
            ->assertJsonPath('data.steps.0.rank', 2)
            ->assertJsonPath('data.steps.0.revealed', false)
            ->assertJsonCount(2, 'data.steps.0.rows')
            ->assertJsonPath('data.steps.1.rank', 1)
            ->assertJsonPath('data.steps.1.rows.0.score', '90.00');
    }

    public function test_permissions_are_enforced(): void
    {
        [$event, $admin] = $this->finished();
        $judge = User::factory()->judge()->create();
        $url = "/api/v1/events/{$event->id}/reveal";

        $this->getJson($url)->assertUnauthorized();

        $this->publish($event, $admin, ['reveal' => true]);

        $this->actor($judge)->getJson($url)->assertForbidden();
        $this->actor($judge)->postJson($url, ['action' => 'next'])->assertForbidden();
        $this->actor($admin)->postJson($url, ['action' => 'explode'])->assertUnprocessable()->assertJsonValidationErrors('action');
    }

    public function test_reveal_needs_a_publication_with_reveal_turned_on(): void
    {
        [$event, $admin] = $this->finished();

        $this->act($event, $admin, 'next')->assertUnprocessable()->assertJsonValidationErrors('publication');
        $this->actor($admin)->getJson("/api/v1/events/{$event->id}/reveal")->assertOk()->assertJsonPath('data.published', false);

        $this->publish($event, $admin);
        $this->act($event, $admin, 'next')->assertUnprocessable()->assertJsonValidationErrors('reveal');
    }

    public function test_republishing_starts_hidden_again(): void
    {
        [$event, $admin] = $this->finished();
        $super = User::factory()->superAdmin()->create();
        $this->publish($event, $admin, ['reveal' => true]);
        $this->act($event, $admin, 'all')->assertOk();

        $this->actor($super)->postJson("/api/v1/events/{$event->id}/results/unpublish")->assertOk();
        $this->publish($event, $admin, ['reveal' => true, 'correction_reason' => 'Fix']);

        $this->assertSame(['4'], $this->publicNumbers($event));
        $this->getJson("/api/v1/public/events/{$event->code}/results")->assertJsonPath('data.revision', 2);
    }

    public function test_reveal_options_are_validated(): void
    {
        [$event, $admin] = $this->finished();
        $url = "/api/v1/events/{$event->id}/results/publish";
        $base = ['visibility' => 'rank_and_score', 'confirm' => true, 'reveal' => true];

        $this->actor($admin)->postJson($url, $base + ['reveal_top' => 0])->assertUnprocessable()->assertJsonValidationErrors('reveal_top');
        $this->actor($admin)->postJson($url, $base + ['reveal_top' => 11])->assertUnprocessable()->assertJsonValidationErrors('reveal_top');
    }

    public function test_actions_are_audited_and_announced_to_public_screens(): void
    {
        [$event, $admin] = $this->finished();
        $this->publish($event, $admin, ['reveal' => true]);
        EventFacade::fake([PublicResultsChanged::class]);

        $this->act($event, $admin, 'next')->assertOk();

        EventFacade::assertDispatched(PublicResultsChanged::class, fn (PublicResultsChanged $e) => $e->eventCode === $event->code && $e->status === 'published');
        $this->assertDatabaseHas('audit_logs', ['action' => 'results.reveal_next', 'user_id' => $admin->id]);
    }
}