<?php

namespace Tests\Feature\Results;

use App\Enums\EventStatus;
use App\Models\Event;
use App\Models\User;
use App\Services\EvaluationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesForms;
use Tests\Concerns\CreatesScoringFixtures;
use Tests\TestCase;

class PublicResultsTest extends TestCase
{
    use RefreshDatabase, CreatesForms, CreatesScoringFixtures;

    /** Three participants scored 90, 80 and 80 by one judge; event completed. */
    private function finished(array $policy = []): array
    {
        [$event, $version, $people, $judges, $admin] = $this->scoringEvent(3, 1, [100], $policy);
        foreach ([90, 80, 80] as $i => $score) {
            app(EvaluationService::class)->submit($event, $people[$i], $judges[0], $this->scoreMap($version, [$score]), $judges[0]);
        }
        $event->forceFill(['status' => EventStatus::Completed])->save();

        return [$event, $version, $people, $judges, $admin];
    }

    private function publish(Event $event, User $admin, string $visibility = 'rank_and_score', array $extra = []): void
    {
        $this->spa()->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/events/{$event->id}/results/publish", array_merge(['visibility' => $visibility, 'confirm' => true], $extra))
            ->assertCreated();
    }

    private function url(Event $event): string
    {
        return "/api/v1/public/events/{$event->code}/results";
    }

    /** @return list<string> */
    private function sortedKeys(array $data): array
    {
        $keys = array_keys($data);
        sort($keys);

        return $keys;
    }

    public function test_unknown_and_unpublished_events_look_identical(): void
    {
        [$event] = $this->finished();

        $missing = $this->getJson('/api/v1/public/events/NOPE-1/results');
        $unpublished = $this->getJson($this->url($event));

        $missing->assertNotFound();
        $unpublished->assertNotFound();
        $this->assertSame($missing->json('message'), $unpublished->json('message'));
    }

    public function test_published_results_are_public_and_need_no_sign_in(): void
    {
        [$event, , , , $admin] = $this->finished();
        $this->publish($event, $admin);

        $this->getJson($this->url($event))
            ->assertOk()
            ->assertJsonPath('data.event.name', $event->name)
            ->assertJsonPath('data.event.code', $event->code)
            ->assertJsonPath('data.event.status', 'completed')
            ->assertJsonPath('data.is_final', true)
            ->assertJsonPath('data.visibility', 'rank_and_score')
            ->assertJsonPath('data.revision', 1)
            ->assertJsonCount(3, 'data.rows')
            ->assertJsonPath('data.rows.0.rank', 1)
            ->assertJsonPath('data.rows.0.score', '90.00')
            ->assertJsonPath('data.rows.1.rank', 2)
            ->assertJsonPath('data.rows.1.tied', true)
            ->assertJsonPath('data.rows.2.rank', 2);
    }

    public function test_only_public_fields_are_exposed(): void
    {
        [$event, , , $judges, $admin] = $this->finished();
        $this->publish($event, $admin);

        $response = $this->getJson($this->url($event))->assertOk();
        $data = $response->json('data');

        $this->assertSame(['event', 'is_final', 'published_at', 'revision', 'rows', 'show_tie_indicator', 'visibility'], $this->sortedKeys($data));
        $this->assertSame(['code', 'name', 'status'], $this->sortedKeys($data['event']));
        $this->assertSame(['name', 'number', 'rank', 'score', 'team_name', 'tied'], $this->sortedKeys($data['rows'][0]));

        $body = $response->getContent();
        $this->assertStringNotContainsString($judges[0]->email, $body);
        $this->assertStringNotContainsString($admin->email, $body);
        $this->assertStringNotContainsString('participant_id', $body);
    }

    public function test_rank_only_publication_hides_scores(): void
    {
        [$event, , , , $admin] = $this->finished();
        $this->publish($event, $admin, 'rank_only');

        $response = $this->getJson($this->url($event))->assertOk()->assertJsonPath('data.visibility', 'rank_only');

        $this->assertSame(['name', 'number', 'rank', 'team_name', 'tied'], $this->sortedKeys($response->json('data.rows.0')));
        $this->assertStringNotContainsString('90.00', $response->getContent());
    }

    public function test_the_event_code_is_case_insensitive(): void
    {
        [$event, , , , $admin] = $this->finished();
        $this->publish($event, $admin);

        $this->getJson('/api/v1/public/events/'.strtolower($event->code).'/results')->assertOk();
    }

    public function test_invalid_codes_never_reach_the_controller(): void
    {
        $this->getJson('/api/v1/public/events/a/results')->assertNotFound();
        $this->getJson('/api/v1/public/events/bad%20code/results')->assertNotFound();
    }

    public function test_the_public_version_is_the_frozen_snapshot_not_live_data(): void
    {
        [$event, $version, $people, $judges, $admin] = $this->finished();
        $this->publish($event, $admin);

        // A later correction moves the last participant to first place in the admin results.
        $evaluation = $people[2]->evaluations()->firstOrFail();
        app(EvaluationService::class)->correct($evaluation, $this->scoreMap($version, [99]), 'Late fix', $admin);

        $this->getJson($this->url($event))
            ->assertOk()
            ->assertJsonPath('data.rows.0.number', '1')
            ->assertJsonPath('data.rows.0.score', '90.00');
    }

    public function test_unpublishing_hides_results_and_republishing_shows_the_new_revision(): void
    {
        [$event, , , , $admin] = $this->finished();
        $super = User::factory()->superAdmin()->create();
        $this->publish($event, $admin);

        $this->spa()->actingAs($super, 'sanctum')->postJson("/api/v1/events/{$event->id}/results/unpublish")->assertOk();
        $this->getJson($this->url($event))->assertNotFound();

        $this->publish($event, $admin, 'rank_and_score', ['correction_reason' => 'Fix']);
        $this->getJson($this->url($event))->assertOk()->assertJsonPath('data.revision', 2);
    }

    public function test_the_tie_indicator_follows_the_frozen_policy(): void
    {
        [$event, , , , $admin] = $this->finished(['show_tie_indicator' => false]);
        $this->publish($event, $admin);

        $this->getJson($this->url($event))->assertOk()->assertJsonPath('data.show_tie_indicator', false);
    }

    public function test_the_response_is_not_cached(): void
    {
        [$event, , , , $admin] = $this->finished();
        $this->publish($event, $admin);

        $this->assertStringContainsString('no-store', $this->getJson($this->url($event))->headers->get('Cache-Control'));
        
    }
}