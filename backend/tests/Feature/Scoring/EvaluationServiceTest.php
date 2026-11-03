<?php

namespace Tests\Feature\Scoring;

use App\Enums\EvaluationStatus;
use App\Enums\EventStatus;
use App\Models\Evaluation;
use App\Models\EvaluationScoreRevision;
use App\Models\ParticipantResult;
use App\Models\User;
use App\Services\EvaluationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\Concerns\CreatesForms;
use Tests\Concerns\CreatesScoringFixtures;
use Tests\TestCase;

class EvaluationServiceTest extends TestCase
{
    use RefreshDatabase, CreatesForms, CreatesScoringFixtures;

    private EvaluationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(EvaluationService::class);
    }

    private function assertInvalid(callable $action, string $key): void
    {
        try {
            $action();
        } catch (ValidationException $e) {
            $this->assertArrayHasKey($key, $e->errors());

            return;
        }

        $this->fail("Expected a validation error for {$key}.");
    }

    public function test_submit_stores_scores_total_and_updates_the_results(): void
    {
        [$event, $version, $people, $judges, $admin] = $this->scoringEvent(1, 1, [60, 40]);
        $scores = $this->scoreMap($version, [80, 90]);

        $evaluation = $this->service->submit($event, $people[0], $judges[0], $scores, $judges[0]);

        $this->assertSame(EvaluationStatus::Submitted, $evaluation->status);
        $this->assertSame('84.00', $evaluation->total_score);
        $this->assertNotNull($evaluation->submitted_at);
        $this->assertSame(2, $evaluation->scores()->count());

        $result = ParticipantResult::where('participant_id', $people[0]->id)->firstOrFail();
        $this->assertSame('84.00', $result->aggregate_score);
        $this->assertSame(1, $result->rank);
        $this->assertTrue($result->is_complete);
        $this->assertDatabaseHas('audit_logs', ['action' => 'evaluation.submitted', 'user_id' => $judges[0]->id]);
    }

    public function test_a_second_submission_for_the_same_pair_is_rejected(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(1, 1);
        $scores = $this->scoreMap($version, [80, 90]);
        $this->service->submit($event, $people[0], $judges[0], $scores, $judges[0]);

        $this->assertInvalid(fn () => $this->service->submit($event, $people[0], $judges[0], $scores, $judges[0]), 'evaluation');
        $this->assertSame(1, Evaluation::count());
    }

    public function test_only_assigned_active_judges_can_score(): void
    {
        [$event, $version, $people, $judges, $admin] = $this->scoringEvent(1, 1);
        $scores = $this->scoreMap($version, [80, 90]);

        $stranger = User::factory()->judge()->create();
        $this->assertInvalid(fn () => $this->service->submit($event, $people[0], $stranger, $scores, $stranger), 'judge');
        $this->assertInvalid(fn () => $this->service->submit($event, $people[0], $admin, $scores, $admin), 'judge');

        $judges[0]->forceFill(['is_active' => false])->save();
        $this->assertInvalid(fn () => $this->service->submit($event, $people[0], $judges[0]->fresh(), $scores, $admin), 'judge');

        $this->assertSame(0, Evaluation::count());
    }

    public function test_scoring_requires_an_event_in_progress(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(1, 1, status: EventStatus::Upcoming);

        $this->assertInvalid(
            fn () => $this->service->submit($event, $people[0], $judges[0], $this->scoreMap($version, [80, 90]), $judges[0]),
            'event',
        );
    }

    public function test_the_participant_must_belong_to_the_event_and_be_registered(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(2, 1);
        [, , $otherPeople] = $this->scoringEvent(1, 0);
        $scores = $this->scoreMap($version, [80, 90]);

        $this->assertInvalid(fn () => $this->service->submit($event, $otherPeople[0], $judges[0], $scores, $judges[0]), 'participant');

        $people[1]->forceFill(['status' => 'withdrawn'])->save();
        $this->assertInvalid(fn () => $this->service->submit($event, $people[1]->fresh(), $judges[0], $scores, $judges[0]), 'participant');
    }

    public function test_scores_are_validated(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(1, 1);
        [$first, $second] = $version->criteria()->get()->pluck('id')->all();

        $this->assertInvalid(fn () => $this->service->submit($event, $people[0], $judges[0], [$first => 101, $second => 50], $judges[0]), "scores.{$first}");
        $this->assertInvalid(fn () => $this->service->submit($event, $people[0], $judges[0], [$first => -1, $second => 50], $judges[0]), "scores.{$first}");
        $this->assertInvalid(fn () => $this->service->submit($event, $people[0], $judges[0], [$first => '80.123', $second => 50], $judges[0]), "scores.{$first}");
        $this->assertInvalid(fn () => $this->service->submit($event, $people[0], $judges[0], [$first => 'abc', $second => 50], $judges[0]), "scores.{$first}");
        $this->assertInvalid(fn () => $this->service->submit($event, $people[0], $judges[0], [$first => 80, $second => 50, 999999 => 10], $judges[0]), 'scores.999999');
        $this->assertInvalid(fn () => $this->service->submit($event, $people[0], $judges[0], [$first => 80], $judges[0]), "scores.{$second}");
        $this->assertInvalid(fn () => $this->service->submit($event, $people[0], $judges[0], [], $judges[0]), "scores.{$first}");
        $this->assertInvalid(fn () => $this->service->saveDraft($event, $people[0], $judges[0], [], $judges[0]), 'scores');

        // Nothing was saved by any of the failed attempts.
        $this->assertSame(0, Evaluation::count());
        $this->assertSame(0, ParticipantResult::count());
    }

    public function test_an_optional_criterion_can_be_left_out_and_is_not_counted_as_zero(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(1, 1, [60, 40]);
        $criteria = $version->criteria()->get();
        $criteria->last()->update(['is_required' => false]);

        $evaluation = $this->service->submit($event, $people[0], $judges[0], [$criteria->first()->id => 50], $judges[0]);

        $this->assertSame('50.00', $evaluation->total_score);
    }

    public function test_a_draft_can_be_saved_then_submitted_without_affecting_results(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(1, 1);
        $criteria = $version->criteria()->get()->pluck('id');

        $draft = $this->service->saveDraft($event, $people[0], $judges[0], [$criteria[0] => 70], $judges[0]);

        $this->assertSame(EvaluationStatus::Draft, $draft->status);
        $this->assertNull($draft->total_score);
        $this->assertSame(0, ParticipantResult::count());

        $submitted = $this->service->submit($event, $people[0], $judges[0], $this->scoreMap($version, [70, 80]), $judges[0]);

        $this->assertSame($draft->id, $submitted->id);
        $this->assertSame(EvaluationStatus::Submitted, $submitted->status);
        $this->assertSame(1, Evaluation::count());
        $this->assertSame(2, $submitted->scores()->count());

        $this->assertInvalid(fn () => $this->service->saveDraft($event, $people[0], $judges[0], [$criteria[0] => 10], $judges[0]), 'evaluation');
    }

    public function test_a_correction_keeps_the_history_and_recalculates_the_results(): void
    {
        [$event, $version, $people, $judges, $admin] = $this->scoringEvent(2, 1, [60, 40]);
        $evaluation = $this->service->submit($event, $people[0], $judges[0], $this->scoreMap($version, [80, 90]), $judges[0]);
        $this->service->submit($event, $people[1], $judges[0], $this->scoreMap($version, [85, 85]), $judges[0]);

        $this->assertSame('85.00', ParticipantResult::where('participant_id', $people[1]->id)->value('aggregate_score'));
        $this->assertSame(1, ParticipantResult::where('participant_id', $people[1]->id)->value('rank'));

        $corrected = $this->service->correct($evaluation, $this->scoreMap($version, [100, 100]), 'Typing mistake', $admin);

        $this->assertSame(2, $corrected->revision);
        $this->assertSame('100.00', $corrected->total_score);

        $revision = EvaluationScoreRevision::firstOrFail();
        $this->assertSame($evaluation->id, $revision->evaluation_id);
        $this->assertSame(1, $revision->revision);
        $this->assertSame($admin->id, $revision->changed_by);
        $this->assertSame('Typing mistake', $revision->reason);
        $this->assertSame('84.00', $revision->previous_total);
        $this->assertSame('80.00', $revision->previous_scores[$version->criteria()->first()->id]);

        $first = ParticipantResult::where('participant_id', $people[0]->id)->firstOrFail();
        $this->assertSame('100.00', $first->aggregate_score);
        $this->assertSame(1, $first->rank);
        $this->assertDatabaseHas('audit_logs', ['action' => 'evaluation.corrected', 'user_id' => $admin->id]);
    }

    public function test_a_correction_needs_a_reason_and_a_submitted_evaluation(): void
    {
        [$event, $version, $people, $judges, $admin] = $this->scoringEvent(1, 1);
        $participant = $people->first();
        $judge = $judges->first();
        $ids = $version->criteria()->get()->pluck('id')->all();
        $full = $this->scoreMap($version, [80, 90]);

        $draft = $this->service->saveDraft($event, $participant, $judge, [$ids[0] => 70], $judge);
        $this->assertInvalid(fn () => $this->service->correct($draft, $full, 'Fix', $admin), 'evaluation');

        $submitted = $this->service->submit($event, $participant, $judge, $full, $judge);
        $this->assertInvalid(fn () => $this->service->correct($submitted, $full, '   ', $admin), 'reason');
        $this->assertSame(0, EvaluationScoreRevision::count());
    }
}