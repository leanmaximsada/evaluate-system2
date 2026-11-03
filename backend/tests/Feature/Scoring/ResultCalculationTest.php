<?php

namespace Tests\Feature\Scoring;

use App\Enums\EventStatus;
use App\Models\ParticipantResult;
use App\Services\EvaluationService;
use App\Services\ResultService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesForms;
use Tests\Concerns\CreatesScoringFixtures;
use Tests\TestCase;
use App\Models\EvaluationFormVersion;
use App\Models\Event;
use App\Models\Participant;
use App\Models\User;

class ResultCalculationTest extends TestCase
{
    use RefreshDatabase, CreatesForms, CreatesScoringFixtures;

       private function submit(Event $event, EvaluationFormVersion $version, Participant $participant, User $judge, array $values): void
    {
        app(EvaluationService::class)->submit($event, $participant, $judge, $this->scoreMap($version, $values), $judge);
    }

    private function resultFor(Participant $participant): ParticipantResult
    {
        return ParticipantResult::where('participant_id', $participant->id)->firstOrFail();
    }

    public function test_the_aggregate_is_the_mean_of_the_judges_who_submitted(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(1, 3, [50, 50]);

        $this->submit($event, $version, $people[0], $judges[0], [80, 80]);
        $this->submit($event, $version, $people[0], $judges[1], [90, 90]);

        $result = $this->resultFor($people[0]);
        $this->assertSame('85.00', $result->aggregate_score);
        $this->assertSame(2, $result->evaluations_submitted);
        $this->assertSame(3, $result->judges_assigned);
        $this->assertFalse($result->is_complete);

        $this->submit($event, $version, $people[0], $judges[2], [100, 100]);

        $result = $this->resultFor($people[0]);
        $this->assertSame('90.00', $result->aggregate_score);
        $this->assertTrue($result->is_complete);
    }

    public function test_missing_evaluations_are_excluded_not_counted_as_zero(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(1, 2, [100]);

        $this->submit($event, $version, $people[0], $judges[0], [60]);

        $this->assertSame('60.00', $this->resultFor($people[0])->aggregate_score);
    }

    public function test_a_participant_without_evaluations_is_unranked(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(2, 1, [100]);
        $this->submit($event, $version, $people[0], $judges[0], [70]);

        $unscored = $this->resultFor($people[1]);
        $this->assertNull($unscored->aggregate_score);
        $this->assertNull($unscored->rank);
        $this->assertSame(0, $unscored->evaluations_submitted);
        $this->assertSame(1, $this->resultFor($people[0])->rank);
    }

    public function test_standard_ties_share_a_rank_and_skip_the_next(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(3, 1, [100]);
        $this->submit($event, $version, $people[0], $judges[0], [90]);
        $this->submit($event, $version, $people[1], $judges[0], [90]);
        $this->submit($event, $version, $people[2], $judges[0], [80]);

        $this->assertSame([1, 1, 3], [$this->resultFor($people[0])->rank, $this->resultFor($people[1])->rank, $this->resultFor($people[2])->rank]);
        $this->assertTrue($this->resultFor($people[0])->is_tied);
        $this->assertFalse($this->resultFor($people[2])->is_tied);
    }

    public function test_dense_policy_does_not_skip(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(3, 1, [100], ['tie_policy' => 'dense']);
        $this->submit($event, $version, $people[0], $judges[0], [90]);
        $this->submit($event, $version, $people[1], $judges[0], [90]);
        $this->submit($event, $version, $people[2], $judges[0], [80]);

        $this->assertSame(2, $this->resultFor($people[2])->rank);
    }

    public function test_the_score_precision_policy_decides_rounding_and_ties(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(2, 1, [100], ['score_precision' => 0]);
        $this->submit($event, $version, $people[0], $judges[0], [86.5]);
        $this->submit($event, $version, $people[1], $judges[0], [87.4]);

        $this->assertSame('87.00', $this->resultFor($people[0])->aggregate_score);
        $this->assertSame('87.00', $this->resultFor($people[1])->aggregate_score);
        $this->assertSame([1, 1], [$this->resultFor($people[0])->rank, $this->resultFor($people[1])->rank]);
    }

    public function test_withdrawn_participants_are_removed_from_the_ranking(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(3, 1, [100]);
        $this->submit($event, $version, $people[0], $judges[0], [95]);
        $this->submit($event, $version, $people[1], $judges[0], [90]);
        $this->submit($event, $version, $people[2], $judges[0], [80]);

        $people[0]->forceFill(['status' => 'withdrawn'])->save();
        app(ResultService::class)->recalculate($event);

        $this->assertNull($this->resultFor($people[0])->rank);
        $this->assertNull($this->resultFor($people[0])->aggregate_score);
        $this->assertSame(1, $this->resultFor($people[1])->rank);
        $this->assertSame(2, $this->resultFor($people[2])->rank);
    }

    public function test_recalculation_is_repeatable(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(2, 1, [100]);
        $this->submit($event, $version, $people[0], $judges[0], [70]);

        $service = app(ResultService::class);
        $first = $service->recalculate($event)->map(fn ($r) => [$r->participant_id, $r->aggregate_score, $r->rank])->all();
        $second = $service->recalculate($event)->map(fn ($r) => [$r->participant_id, $r->aggregate_score, $r->rank])->all();

        $this->assertSame($first, $second);
        $this->assertSame(2, ParticipantResult::count());
    }

    public function test_events_that_have_not_started_get_no_result_rows(): void
    {
        [$event] = $this->scoringEvent(2, 1, status: EventStatus::Draft);

        $this->assertCount(0, app(ResultService::class)->recalculate($event));
        $this->assertSame(0, ParticipantResult::count());
    }

    public function test_the_frozen_policy_beats_the_live_settings_and_falls_back_to_them(): void
    {
        [$event] = $this->scoringEvent(1, 1, [100], ['tie_policy' => 'dense', 'score_precision' => 1]);
        $service = app(ResultService::class);

        $policy = $service->policyFor($event);
        $this->assertSame('dense', $policy['tie_policy']);
        $this->assertSame(1, $policy['score_precision']);

        $event->scoring_policy = null;
        $fallback = $service->policyFor($event);
        $this->assertSame('standard', $fallback['tie_policy']);
        $this->assertSame(2, $fallback['score_precision']);
    }
}