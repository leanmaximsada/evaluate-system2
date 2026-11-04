<?php

namespace App\Services;

use App\Enums\EventStatus;
use App\Models\Evaluation;
use App\Models\Event;
use App\Models\Participant;
use App\Models\ParticipantResult;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use App\Events\ResultsUpdated;
use App\Support\SafeBroadcast;

class ResultService
{
    public function __construct(
        private readonly ScoringService $scoring,
        private readonly RankingService $ranking,
        private readonly SettingsService $settings,
    ) {}

    /** The frozen policy of a started event, otherwise the live Settings (provisional). */
    public function policyFor(Event $event): array
    {
        $live = $this->settings->all()['evaluation'];

        return array_merge(
            ['score_precision' => (int) $live['score_precision'], 'tie_policy' => $live['tie_policy']],
            $event->scoring_policy ?? [],
        );
    }

    /**
     * Recomputes every participant's aggregate and rank for the event from the stored scores.
     * Safe to run any number of times; it always gives the same answer for the same data.
     *
     * @return Collection<int, ParticipantResult>
     */
    public function recalculate(Event $event): Collection
    {
        return DB::transaction(function () use ($event) {
            // Serialises concurrent submissions so two recalculations never interleave.
            $event = Event::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();

            if (! in_array($event->status, [EventStatus::InProgress, EventStatus::Completed], true)) {
                return new Collection();
            }

            $policy = $this->policyFor($event);
            $precision = max(0, min(2, (int) $policy['score_precision']));
            $judgesAssigned = $event->judges()->count();

            $participants = Participant::where('event_id', $event->id)->orderBy('presentation_order')->get();
            $evaluations = Evaluation::where('event_id', $event->id)
                ->where('status', 'submitted')
                ->with(['scores', 'formVersion.criteria'])
                ->get()
                ->groupBy('participant_id');

            $entries = [];
            $meta = [];

            foreach ($participants as $participant) {
                $submitted = $evaluations->get($participant->id, collect());
                $totals = [];

                foreach ($submitted as $evaluation) {
                    $scores = $evaluation->scores
                        ->mapWithKeys(fn ($s) => [$s->evaluation_criterion_id => (string) $s->score])
                        ->all();

                    $total = $this->scoring->judgeTotal($evaluation->formVersion->is_weighted, $evaluation->formVersion->criteria, $scores);
                    if ($total !== null) {
                        $totals[] = $total;
                    }
                }

                $registered = $participant->status === 'registered';
                $mean = $this->scoring->mean($totals);
                $score = ($registered && $mean !== null) ? $this->scoring->round($mean, $precision) : null;

                $entries[] = ['id' => $participant->id, 'score' => $score, 'order' => (int) $participant->presentation_order];
                $meta[$participant->id] = [
                    'score' => $score,
                    'submitted' => $submitted->count(),
                    'complete' => $registered && $judgesAssigned > 0 && $submitted->count() >= $judgesAssigned,
                ];
            }

            $ranks = collect($this->ranking->rank($entries, (string) $policy['tie_policy']))->keyBy('id');
            $rows = new Collection();

            foreach ($ranks as $participantId => $placing) {
                $row = ParticipantResult::where('event_id', $event->id)->where('participant_id', $participantId)->first()
                    ?? new ParticipantResult();

                $row->event_id = $event->id;
                $row->participant_id = $participantId;
                $row->aggregate_score = $meta[$participantId]['score'] === null ? null : $this->scoring->decimal($meta[$participantId]['score']);
                $row->rank = $placing['rank'];
                $row->is_tied = $placing['tied'];
                $row->judges_assigned = $judgesAssigned;
                $row->evaluations_submitted = $meta[$participantId]['submitted'];
                $row->is_complete = $meta[$participantId]['complete'];
                $row->calculated_at = Carbon::now();
                $row->save();

                $rows->push($row);
            }
                SafeBroadcast::afterCommit(new ResultsUpdated($event->id, Carbon::now()->toIso8601String()));

            return $rows;
            
        });
    }

        /**
     * One row per participant, best rank first, unranked last. Built from the stored results.
     *
     * @return list<array<string, mixed>>
     */
    public function rows(Event $event): array
    {
        $participants = Participant::where('event_id', $event->id)->with('result')->orderBy('presentation_order')->get();

        $rows = $participants->map(function (Participant $p) {
            $r = $p->result;
            $submitted = (int) ($r?->evaluations_submitted ?? 0);
            $complete = (bool) ($r?->is_complete ?? false);

            return [
                'participant_id' => $p->id,
                'number' => $p->number,
                'name' => $p->name,
                'team_name' => $p->team_name,
                'participant_status' => $p->status,
                'presentation_order' => (int) $p->presentation_order,
                'aggregate_score' => $r?->aggregate_score,
                'rank' => $r?->rank,
                'is_tied' => (bool) ($r?->is_tied ?? false),
                'judges_assigned' => (int) ($r?->judges_assigned ?? 0),
                'evaluations_submitted' => $submitted,
                'is_complete' => $complete,
                'evaluation_status' => $complete ? 'complete' : ($submitted > 0 ? 'partial' : 'none'),
                'calculated_at' => $r?->calculated_at?->toIso8601String(),
            ];
        })->all();

        usort($rows, fn (array $a, array $b) => (($a['rank'] ?? PHP_INT_MAX) <=> ($b['rank'] ?? PHP_INT_MAX))
            ?: ($a['presentation_order'] <=> $b['presentation_order']));

        return $rows;
    }
}