<?php

namespace Tests\Feature\Judge;

use App\Enums\EventStatus;
use App\Events\ResultsUpdated;
use App\Models\Event;
use App\Models\Participant;
use App\Models\ParticipantResult;
use App\Models\User;
use App\Services\EvaluationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event as EventFacade;
use Tests\Concerns\CreatesForms;
use Tests\Concerns\CreatesScoringFixtures;
use Tests\TestCase;

class JudgePortalTest extends TestCase
{
    use RefreshDatabase, CreatesForms, CreatesScoringFixtures;

    private function judge(User $user): static
    {
        return $this->spa()->actingAs($user, 'sanctum');
    }

    private function scorePath(Event $event, Participant $participant): string
    {
        return "/api/v1/judge/events/{$event->id}/participants/{$participant->id}";
    }

    public function test_only_active_judges_can_use_the_portal(): void
    {
        [, , , $judges, $admin] = $this->scoringEvent(1, 1);

        $this->getJson('/api/v1/judge/events')->assertUnauthorized();
        $this->judge($admin)->getJson('/api/v1/judge/events')->assertForbidden();
        $this->judge($judges[0])->getJson('/api/v1/judge/events')->assertOk();

        $judges[0]->forceFill(['is_active' => false])->save();
        $this->judge($judges[0]->fresh())->getJson('/api/v1/judge/events')->assertForbidden();
    }

    public function test_a_judge_cannot_use_the_admin_api(): void
    {
        [$event, , , $judges] = $this->scoringEvent(1, 1);

        foreach (['/api/v1/events', '/api/v1/users', '/api/v1/settings', '/api/v1/evaluation-forms', "/api/v1/events/{$event->id}/results"] as $url) {
            $this->judge($judges[0])->getJson($url)->assertForbidden();
        }
    }

    public function test_the_event_list_shows_only_my_events_in_progress_with_my_progress(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(3, 2, [100]);
        $service = app(EvaluationService::class);
        $service->submit($event, $people[0], $judges[0], $this->scoreMap($version, [80]), $judges[0]);
        $service->saveDraft($event, $people[1], $judges[0], $this->scoreMap($version, [70]), $judges[0]);

        [$upcoming] = $this->scoringEvent(1, 0, status: EventStatus::Upcoming);
        $upcoming->judges()->attach($judges[0]->id, ['assigned_by' => $judges[0]->id]);
        $this->scoringEvent(1, 1); // somebody else's event

        $this->judge($judges[0])->getJson('/api/v1/judge/events')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $event->id)
            ->assertJsonPath('data.0.participants_total', 3)
            ->assertJsonPath('data.0.submitted', 1)
            ->assertJsonPath('data.0.drafts', 1);

        $this->judge($judges[1])->getJson('/api/v1/judge/events')
            ->assertJsonPath('data.0.submitted', 0)->assertJsonPath('data.0.drafts', 0);
    }

    public function test_the_event_view_hides_other_judges_scores_withdrawn_participants_and_inactive_criteria(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(3, 2, [60, 40]);
        $criteria = $version->criteria()->get();
        $criteria->last()->update(['is_active' => false]);
        $people[2]->forceFill(['status' => 'withdrawn'])->save();
        app(EvaluationService::class)->submit($event, $people[0], $judges[1], [$criteria->first()->id => 77], $judges[1]);

        $response = $this->judge($judges[0])->getJson("/api/v1/judge/events/{$event->id}")
            ->assertOk()
            ->assertJsonPath('data.is_weighted', true)
            ->assertJsonCount(1, 'data.criteria')
            ->assertJsonCount(2, 'data.participants')
            ->assertJsonPath('data.participants.0.evaluation_status', 'not_started')
            ->assertJsonMissingPath('data.participants.0.rank')
            ->assertJsonMissingPath('data.participants.0.aggregate_score');

        $this->assertStringNotContainsString($judges[1]->email, $response->getContent());
    }

    public function test_unassigned_and_not_started_events_are_not_found(): void
    {
        [$event, , $people, $judges] = $this->scoringEvent(1, 1);
        $stranger = User::factory()->judge()->create();

        $this->judge($stranger)->getJson("/api/v1/judge/events/{$event->id}")->assertNotFound();
        $this->judge($stranger)->getJson($this->scorePath($event, $people[0]))->assertNotFound();

        $event->forceFill(['status' => EventStatus::Upcoming])->save();
        $this->judge($judges[0])->getJson("/api/v1/judge/events/{$event->id}")->assertNotFound();
        $this->judge($judges[0])->getJson($this->scorePath($event, $people[0]))->assertNotFound();
    }

    public function test_withdrawn_participants_and_other_events_participants_are_not_found(): void
    {
        [$event, , $people, $judges] = $this->scoringEvent(2, 1);
        [, , $others] = $this->scoringEvent(1, 0);
        $people[1]->forceFill(['status' => 'withdrawn'])->save();

        $this->judge($judges[0])->getJson($this->scorePath($event, $people[1]))->assertNotFound();
        $this->judge($judges[0])->getJson($this->scorePath($event, $others[0]))->assertNotFound();
    }

    public function test_a_draft_is_saved_reloaded_and_not_counted(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(1, 1, [60, 40]);
        [$first, $second] = $version->criteria()->get()->pluck('id')->all();
        $url = $this->scorePath($event, $people[0]);

        $this->judge($judges[0])->getJson($url)
            ->assertOk()
            ->assertJsonPath('data.participant.number', '1')
            ->assertJsonCount(2, 'data.criteria')
            ->assertJsonPath('data.evaluation.status', 'not_started');

        $this->judge($judges[0])->putJson("{$url}/draft", ['scores' => [$first => '70', $second => '']])
            ->assertOk()->assertJsonPath('data.evaluation.status', 'draft');

        $this->judge($judges[0])->getJson($url)
            ->assertJsonPath('data.evaluation.status', 'draft')
            ->assertJsonPath("data.evaluation.scores.{$first}", '70.00')
            ->assertJsonMissingPath("data.evaluation.scores.{$second}");

        $this->assertSame(0, ParticipantResult::count());
    }

    public function test_scores_are_validated_against_each_criterion(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(1, 1, [60, 40]);
        [$first] = $version->criteria()->get()->pluck('id')->all();
        $url = $this->scorePath($event, $people[0]).'/draft';

        $this->judge($judges[0])->putJson($url, ['scores' => [$first => '101']])->assertUnprocessable()->assertJsonValidationErrors("scores.{$first}");
        $this->judge($judges[0])->putJson($url, ['scores' => [$first => '-1']])->assertUnprocessable()->assertJsonValidationErrors("scores.{$first}");
        $this->judge($judges[0])->putJson($url, ['scores' => [$first => 'abc']])->assertUnprocessable()->assertJsonValidationErrors("scores.{$first}");
        $this->judge($judges[0])->putJson($url, ['scores' => [$first => '80.123']])->assertUnprocessable()->assertJsonValidationErrors("scores.{$first}");
        $this->judge($judges[0])->putJson($url, ['scores' => [$first => '']])->assertUnprocessable()->assertJsonValidationErrors('scores');
        $this->judge($judges[0])->putJson($url, ['scores' => []])->assertUnprocessable()->assertJsonValidationErrors('scores');
    }

    public function test_submitting_needs_confirmation_and_every_required_score(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(1, 1, [60, 40]);
        [$first, $second] = $version->criteria()->get()->pluck('id')->all();
        $url = $this->scorePath($event, $people[0]).'/submit';

        $this->judge($judges[0])->postJson($url, ['scores' => [$first => '80', $second => '90']])
            ->assertUnprocessable()->assertJsonValidationErrors('confirm');

        $this->judge($judges[0])->postJson($url, ['scores' => [$first => '80'], 'confirm' => true])
            ->assertUnprocessable()->assertJsonValidationErrors("scores.{$second}");

        $this->assertSame(0, ParticipantResult::count());
    }

    public function test_a_submission_is_final_for_the_judge_and_updates_the_results(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(1, 1, [60, 40]);
        [$first, $second] = $version->criteria()->get()->pluck('id')->all();
        $base = $this->scorePath($event, $people[0]);

        $this->judge($judges[0])->postJson("{$base}/submit", ['scores' => [$first => '80', $second => '90'], 'confirm' => true])
            ->assertOk()
            ->assertJsonPath('data.evaluation.status', 'submitted')
            ->assertJsonPath('data.evaluation.total_score', '84.00')
            ->assertJsonMissingPath('data.rank');

        $result = ParticipantResult::firstOrFail();
        $this->assertSame('84.00', $result->aggregate_score);
        $this->assertSame(1, $result->rank);
        $this->assertDatabaseHas('audit_logs', ['action' => 'evaluation.submitted', 'user_id' => $judges[0]->id]);

        $this->judge($judges[0])->postJson("{$base}/submit", ['scores' => [$first => '10', $second => '10'], 'confirm' => true])
            ->assertUnprocessable()->assertJsonValidationErrors('evaluation');
        $this->judge($judges[0])->putJson("{$base}/draft", ['scores' => [$first => '10']])
            ->assertUnprocessable()->assertJsonValidationErrors('evaluation');

        $this->judge($judges[0])->getJson($base)
            ->assertJsonPath('data.evaluation.status', 'submitted')
            ->assertJsonPath('data.evaluation.total_score', '84.00')
            ->assertJsonPath("data.evaluation.scores.{$first}", '80.00');
        $this->assertSame('84.00', ParticipantResult::firstOrFail()->aggregate_score);
    }

    public function test_an_unassigned_judge_cannot_score(): void
    {
        [$event, $version, $people] = $this->scoringEvent(1, 1, [100]);
        $stranger = User::factory()->judge()->create();
        $criterion = $version->criteria()->firstOrFail()->id;

        $this->judge($stranger)->postJson($this->scorePath($event, $people[0]).'/submit', ['scores' => [$criterion => '80'], 'confirm' => true])
            ->assertNotFound();
        $this->assertSame(0, ParticipantResult::count());
    }

    public function test_a_submission_notifies_the_admin_results_channel(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(1, 1, [100]);
        $criterion = $version->criteria()->firstOrFail()->id;
        EventFacade::fake([ResultsUpdated::class]);

        $this->judge($judges[0])->postJson($this->scorePath($event, $people[0]).'/submit', ['scores' => [$criterion => '80'], 'confirm' => true])
            ->assertOk();

        EventFacade::assertDispatched(ResultsUpdated::class, fn (ResultsUpdated $e) => $e->eventId === $event->id);
    }
}