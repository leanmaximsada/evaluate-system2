<?php

namespace Tests\Feature\Results;

use App\Enums\EventStatus;
use App\Models\Evaluation;
use App\Models\EvaluationFormVersion;
use App\Models\Event;
use App\Models\Participant;
use App\Models\ParticipantResult;
use App\Models\ResultPublication;
use App\Models\User;
use App\Services\EvaluationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesForms;
use Tests\Concerns\CreatesScoringFixtures;
use Tests\TestCase;

class ResultsApiTest extends TestCase
{
    use RefreshDatabase, CreatesForms, CreatesScoringFixtures;

    private function actor(User $user): static
    {
        return $this->spa()->actingAs($user, 'sanctum');
    }

    private function submit(Event $event, EvaluationFormVersion $version, Participant $participant, User $judge, int $score): Evaluation
    {
        return app(EvaluationService::class)->submit($event, $participant, $judge, $this->scoreMap($version, [$score]), $judge);
    }

    private function complete(Event $event): void
    {
        $event->forceFill(['status' => EventStatus::Completed])->save();
    }

    /** Three participants scored 90, 80 and 70 by one judge, event completed. */
    private function finishedEvent(): array
    {
        [$event, $version, $people, $judges, $admin] = $this->scoringEvent(3, 1, [100]);
        foreach ([90, 80, 70] as $i => $score) {
            $this->submit($event, $version, $people[$i], $judges[0], $score);
        }
        $this->complete($event);

        return [$event, $version, $people, $judges, $admin];
    }

    private function payload(array $overrides = []): array
    {
        return array_merge(['visibility' => 'rank_and_score', 'confirm' => true], $overrides);
    }

    public function test_permissions_are_enforced(): void
    {
        [$event, , $people, , $admin] = $this->scoringEvent(1, 1);
        $url = "/api/v1/events/{$event->id}/results";

        $this->getJson($url)->assertUnauthorized();

        $judge = User::factory()->judge()->create();
        $this->actor($judge)->getJson($url)->assertForbidden();
        $this->actor($judge)->getJson("{$url}/{$people[0]->id}")->assertForbidden();
        $this->actor($judge)->get("{$url}/export?format=csv")->assertForbidden();
        $this->actor($judge)->postJson("{$url}/recalculate")->assertForbidden();
        $this->actor($judge)->postJson("{$url}/publish", $this->payload())->assertForbidden();

        $this->actor($admin)->getJson($url)->assertOk();
        $this->actor($admin)->postJson("{$url}/unpublish")->assertForbidden();
    }

    public function test_overview_shows_ranks_completion_and_publication_state(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(3, 2, [100]);
        $this->submit($event, $version, $people[0], $judges[0], 90);
        $this->submit($event, $version, $people[0], $judges[1], 80);
        $this->submit($event, $version, $people[1], $judges[0], 70);
        $admin = User::factory()->admin()->create();

        $this->actor($admin)->getJson("/api/v1/events/{$event->id}/results")
            ->assertOk()
            ->assertJsonPath('data.event.status', 'in_progress')
            ->assertJsonPath('data.is_provisional', true)
            ->assertJsonPath('data.summary.judges_assigned', 2)
            ->assertJsonPath('data.summary.evaluations_expected', 6)
            ->assertJsonPath('data.summary.evaluations_submitted', 3)
            ->assertJsonPath('data.summary.completion_percent', 50)
            ->assertJsonPath('data.publication.status', 'none')
            ->assertJsonPath('data.rows.0.number', '1')
            ->assertJsonPath('data.rows.0.aggregate_score', '85.00')
            ->assertJsonPath('data.rows.0.rank', 1)
            ->assertJsonPath('data.rows.0.evaluation_status', 'complete')
            ->assertJsonPath('data.rows.1.evaluation_status', 'partial')
            ->assertJsonPath('data.rows.2.rank', null)
            ->assertJsonPath('data.rows.2.evaluation_status', 'none');
    }

    public function test_overview_works_before_the_event_starts(): void
    {
        [$event, , , , $admin] = $this->scoringEvent(2, 1, status: EventStatus::Draft);

        $this->actor($admin)->getJson("/api/v1/events/{$event->id}/results")
            ->assertOk()
            ->assertJsonCount(2, 'data.rows')
            ->assertJsonPath('data.rows.0.rank', null)
            ->assertJsonPath('data.summary.completion_percent', 0);
    }

    public function test_participant_detail_shows_each_judge_scores_and_history(): void
    {
        [$event, $version, $people, $judges, $admin] = $this->scoringEvent(1, 2, [100]);
        $evaluation = $this->submit($event, $version, $people[0], $judges[0], 90);
        app(EvaluationService::class)->correct($evaluation, $this->scoreMap($version, [95]), 'Typo', $admin);

        $response = $this->actor($admin)->getJson("/api/v1/events/{$event->id}/results/{$people[0]->id}")
            ->assertOk()
            ->assertJsonPath('data.participant.number', '1')
            ->assertJsonPath('data.result.aggregate_score', '95.00')
            ->assertJsonCount(2, 'data.judges');

        $judgesData = collect($response->json('data.judges'));
        $submitted = $judgesData->firstWhere('status', 'submitted');

        $this->assertSame($judges[0]->id, $submitted['judge']['id']);
        $this->assertSame('95.00', $submitted['scores'][0]['score']);
        $this->assertSame(2, $submitted['revision']);
        $this->assertSame('Typo', $submitted['revisions'][0]['reason']);
        $this->assertSame('90.00', $submitted['revisions'][0]['previous_total']);
        $this->assertSame('not_started', $judgesData->firstWhere('judge.id', $judges[1]->id)['status']);
    }

    public function test_a_participant_of_another_event_is_not_found(): void
    {
        [$event, , , , $admin] = $this->scoringEvent(1, 1);
        [, , $others] = $this->scoringEvent(1, 0);

        $this->actor($admin)->getJson("/api/v1/events/{$event->id}/results/{$others[0]->id}")->assertNotFound();
    }

    public function test_recalculate_rebuilds_the_results(): void
    {
        [$event, $version, $people, $judges, $admin] = $this->scoringEvent(2, 1, [100]);
        $this->submit($event, $version, $people[0], $judges[0], 90);
        $this->submit($event, $version, $people[1], $judges[0], 80);

        $people[0]->forceFill(['status' => 'withdrawn'])->save();

        $this->actor($admin)->postJson("/api/v1/events/{$event->id}/results/recalculate")
            ->assertOk()
            ->assertJsonPath('data.rows.0.number', '2')
            ->assertJsonPath('data.rows.0.rank', 1);

        $this->assertDatabaseHas('audit_logs', ['action' => 'results.recalculated']);
    }

    public function test_withdrawing_a_participant_recalculates_immediately(): void
    {
        [$event, $version, $people, $judges, $admin] = $this->scoringEvent(2, 1, [100]);
        $this->submit($event, $version, $people[0], $judges[0], 90);
        $this->submit($event, $version, $people[1], $judges[0], 80);

        $this->actor($admin)->putJson("/api/v1/events/{$event->id}/participants/{$people[0]->id}", [
            'name' => $people[0]->name, 'number' => '1', 'status' => 'withdrawn',
        ])->assertOk();

        $this->assertNull(ParticipantResult::where('participant_id', $people[0]->id)->value('rank'));
        $this->assertSame(1, ParticipantResult::where('participant_id', $people[1]->id)->value('rank'));
    }

    public function test_publishing_requires_a_completed_event(): void
    {
        [$event, $version, $people, $judges, $admin] = $this->scoringEvent(1, 1, [100]);
        $this->submit($event, $version, $people[0], $judges[0], 90);

        $this->actor($admin)->postJson("/api/v1/events/{$event->id}/results/publish", $this->payload())
            ->assertUnprocessable()->assertJsonValidationErrors('event');
        $this->assertSame(0, ResultPublication::count());
    }

    public function test_publish_unpublish_and_republish_with_a_correction_reason(): void
    {
        [$event, , , , $admin] = $this->finishedEvent();
        $super = User::factory()->superAdmin()->create();
        $url = "/api/v1/events/{$event->id}/results";

        // Confirmation and visibility are mandatory.
        $this->actor($admin)->postJson("{$url}/publish", $this->payload(['confirm' => false]))
            ->assertUnprocessable()->assertJsonValidationErrors('confirm');
        $this->actor($admin)->postJson("{$url}/publish", ['confirm' => true])
            ->assertUnprocessable()->assertJsonValidationErrors('visibility');

        $this->actor($admin)->postJson("{$url}/publish", $this->payload(['visibility' => 'rank_only']))
            ->assertCreated()
            ->assertJsonPath('data.revision', 1)
            ->assertJsonPath('data.status', 'published')
            ->assertJsonPath('data.visibility', 'rank_only')
            ->assertJsonPath('data.is_final', true);

        $snapshot = ResultPublication::firstOrFail()->snapshot;
        $this->assertCount(3, $snapshot['rows']);
        $this->assertSame('1', $snapshot['rows'][0]['number']);
        $this->assertSame(1, $snapshot['rows'][0]['rank']);
        $this->assertArrayNotHasKey('score', $snapshot['rows'][0]);

        // Only one live publication at a time.
        $this->actor($admin)->postJson("{$url}/publish", $this->payload())
            ->assertUnprocessable()->assertJsonValidationErrors('publication');

        // Only a Super Admin can unpublish.
        $this->actor($admin)->postJson("{$url}/unpublish")->assertForbidden();
        $this->actor($super)->postJson("{$url}/unpublish", ['reason' => 'Wrong judge score'])
            ->assertOk()->assertJsonPath('data.status', 'unpublished');
        $this->actor($super)->postJson("{$url}/unpublish")->assertUnprocessable();

        // Republishing needs a reason and creates a new revision.
        $this->actor($admin)->postJson("{$url}/publish", $this->payload())
            ->assertUnprocessable()->assertJsonValidationErrors('correction_reason');
        $this->actor($admin)->postJson("{$url}/publish", $this->payload(['correction_reason' => 'Fixed a score']))
            ->assertCreated()->assertJsonPath('data.revision', 2)->assertJsonPath('data.correction_reason', 'Fixed a score');

        $second = ResultPublication::where('revision', 2)->firstOrFail()->snapshot;
        $this->assertSame('90.00', $second['rows'][0]['score']);

        $this->assertDatabaseHas('audit_logs', ['action' => 'results.published', 'user_id' => $admin->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'results.unpublished', 'user_id' => $super->id]);
    }

    public function test_incomplete_evaluations_block_publishing_unless_accepted(): void
    {
        [$event, $version, $people, $judges, $admin] = $this->scoringEvent(2, 2, [100]);
        $this->submit($event, $version, $people[0], $judges[0], 90);
        $this->submit($event, $version, $people[0], $judges[1], 80);
        $this->submit($event, $version, $people[1], $judges[0], 70);
        $this->complete($event);
        $url = "/api/v1/events/{$event->id}/results/publish";

        $this->actor($admin)->postJson($url, $this->payload())
            ->assertUnprocessable()->assertJsonValidationErrors('results');

        $this->actor($admin)->postJson($url, $this->payload(['accept_incomplete' => true]))->assertCreated();
        $this->assertDatabaseHas('audit_logs', ['action' => 'results.published']);
    }

    public function test_nothing_can_be_published_without_ranked_participants(): void
    {
        [$event, , , , $admin] = $this->scoringEvent(2, 1, [100]);
        $this->complete($event);

        $this->actor($admin)->postJson("/api/v1/events/{$event->id}/results/publish", $this->payload(['accept_incomplete' => true]))
            ->assertUnprocessable()->assertJsonValidationErrors('results');
    }

    public function test_a_published_snapshot_never_changes_and_the_overview_flags_it(): void
    {
        [$event, , $people, , $admin] = $this->finishedEvent();
        $url = "/api/v1/events/{$event->id}/results";
        $this->actor($admin)->postJson("{$url}/publish", $this->payload())->assertCreated();

        $this->actor($admin)->getJson($url)
            ->assertJsonPath('data.publication.status', 'published')
            ->assertJsonPath('data.publication.needs_republish', false);

        // A late correction moves the last participant to first place.
        $evaluation = Evaluation::where('participant_id', $people[2]->id)->firstOrFail();
        app(EvaluationService::class)->correct($evaluation, $this->scoreMap($evaluation->formVersion, [95]), 'Late fix', $admin);

        $this->actor($admin)->getJson($url)
            ->assertJsonPath('data.rows.0.number', '3')
            ->assertJsonPath('data.publication.needs_republish', true);

        $snapshot = ResultPublication::firstOrFail()->snapshot;
        $this->assertSame('1', $snapshot['rows'][0]['number']);
        $this->assertSame('90.00', $snapshot['rows'][0]['score']);
    }

    public function test_the_publication_history_is_kept(): void
    {
        [$event, , , , $admin] = $this->finishedEvent();
        $super = User::factory()->superAdmin()->create();
        $url = "/api/v1/events/{$event->id}/results";

        $this->actor($admin)->postJson("{$url}/publish", $this->payload())->assertCreated();
        $this->actor($super)->postJson("{$url}/unpublish")->assertOk();
        $this->actor($admin)->postJson("{$url}/publish", $this->payload(['correction_reason' => 'Fix']))->assertCreated();

        $this->actor($admin)->getJson("{$url}/publications")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.revision', 2)
            ->assertJsonPath('data.0.status', 'published')
            ->assertJsonPath('data.0.correction_reason', 'Fix')
            ->assertJsonPath('data.1.status', 'unpublished')
            ->assertJsonCount(3, 'data.1.rows');
    }

    public function test_csv_export_contains_results_and_neutralises_formulas(): void
    {
        [$event, , $people, , $admin] = $this->finishedEvent();
        $people[0]->forceFill(['name' => "=cmd|' /C calc'!A0"])->save();

        $response = $this->actor($admin)->get("/api/v1/events/{$event->id}/results/export?format=csv");
        $response->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('results-', $response->headers->get('Content-Disposition'));

        $csv = $response->streamedContent();
        $this->assertStringContainsString("Code,{$event->code}", $csv);
        $this->assertStringContainsString('Rank,Number,Participant', $csv);
        $this->assertStringContainsString('90.00', $csv);
        $this->assertStringContainsString("'=cmd", $csv);
        $this->assertStringNotContainsString('"=cmd', $csv);
        $this->assertDatabaseHas('audit_logs', ['action' => 'results.exported', 'user_id' => $admin->id]);
    }

    public function test_export_validates_the_format(): void
    {
        [$event, , , , $admin] = $this->scoringEvent(1, 1);

        $this->actor($admin)->getJson("/api/v1/events/{$event->id}/results/export?format=pdf")
            ->assertUnprocessable()->assertJsonValidationErrors('format');
        $this->actor($admin)->getJson("/api/v1/events/{$event->id}/results/export")->assertUnprocessable();
    }

    public function test_messages_follow_accept_language(): void
    {
        [$event, , , , $admin] = $this->scoringEvent(1, 1);

        $this->actor($admin)->withHeader('Accept-Language', 'km')
            ->postJson("/api/v1/events/{$event->id}/results/publish", $this->payload())
            ->assertUnprocessable()
            ->assertJsonPath('errors.event.0', 'អាចផ្សព្វផ្សាយលទ្ធផលបានតែបន្ទាប់ពីកម្មវិធីបានបញ្ចប់ប៉ុណ្ណោះ។');
    }
}