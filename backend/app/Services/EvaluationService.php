<?php

namespace App\Services;

use App\Enums\EvaluationStatus;
use App\Enums\EventStatus;
use App\Enums\Role;
use App\Models\Evaluation;
use App\Models\EvaluationFormVersion;
use App\Models\EvaluationScore;
use App\Models\EvaluationScoreRevision;
use App\Models\Event;
use App\Models\Participant;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Judge-to-participant evaluations: the service layer a future judge portal will call.
 * Every method runs in one transaction, so a failure never leaves partial scores behind.
 */
class EvaluationService
{
    public function __construct(
        private readonly ScoringService $scoring,
        private readonly ResultService $results,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array<int, string|int|float>  $scores  criterion id => score (may be partial)
     */
    public function saveDraft(Event $event, Participant $participant, User $judge, array $scores, User $actor): Evaluation
    {
        return DB::transaction(function () use ($event, $participant, $judge, $scores, $actor) {
            [$event, $version] = $this->prepare($event, $participant, $judge);
            $clean = $this->validateScores($version, $scores, false);

            $evaluation = $this->findOrNew($event, $participant, $judge, $version);
            $this->assertNotSubmitted($evaluation);

            $this->persist($evaluation, $version, $clean, EvaluationStatus::Draft);
            $this->audit->log('evaluation.draft_saved', $evaluation, $this->summary($event, $evaluation), $actor);

            return $evaluation;
        });
    }

    /**
     * @param  array<int, string|int|float>  $scores  criterion id => score; every required criterion must be present
     */
    public function submit(Event $event, Participant $participant, User $judge, array $scores, User $actor): Evaluation
    {
        return DB::transaction(function () use ($event, $participant, $judge, $scores, $actor) {
            [$event, $version] = $this->prepare($event, $participant, $judge);
            $clean = $this->validateScores($version, $scores, true);

            $evaluation = $this->findOrNew($event, $participant, $judge, $version);
            $this->assertNotSubmitted($evaluation);

            $this->persist($evaluation, $version, $clean, EvaluationStatus::Submitted);
            $this->audit->log('evaluation.submitted', $evaluation, $this->summary($event, $evaluation), $actor);

            $this->results->recalculate($event);

            return $evaluation;
        });
    }

    /**
     * Administrator correction of a submitted evaluation. Keeps the old scores in a revision record.
     *
     * @param  array<int, string|int|float>  $scores
     */
    public function correct(Evaluation $evaluation, array $scores, string $reason, User $actor): Evaluation
    {
        return DB::transaction(function () use ($evaluation, $scores, $reason, $actor) {
            $reason = trim($reason);
            if ($reason === '') {
                throw ValidationException::withMessages(['reason' => [__('A reason is required for a correction.')]]);
            }

            // Lock the event first, then the evaluation, in the same order as submissions.
            $eventId = Evaluation::query()->whereKey($evaluation->id)->value('event_id');
            $event = Event::query()->whereKey($eventId)->lockForUpdate()->firstOrFail();
            $evaluation = Evaluation::query()->whereKey($evaluation->id)->lockForUpdate()->firstOrFail();

            if (! in_array($event->status, [EventStatus::InProgress, EventStatus::Completed], true)) {
                throw ValidationException::withMessages(['event' => [__('Corrections are only possible while the event is in progress or completed.')]]);
            }
            if ($evaluation->status !== EvaluationStatus::Submitted) {
                throw ValidationException::withMessages(['evaluation' => [__('Only submitted evaluations can be corrected.')]]);
            }

            $version = $evaluation->formVersion()->with('criteria')->firstOrFail();
            $clean = $this->validateScores($version, $scores, true);

            $revision = new EvaluationScoreRevision();
            $revision->evaluation_id = $evaluation->id;
            $revision->revision = $evaluation->revision;
            $revision->changed_by = $actor->id;
            $revision->reason = $reason;
            $revision->previous_scores = $evaluation->scores()->get()
                ->mapWithKeys(fn ($s) => [$s->evaluation_criterion_id => (string) $s->score])->all();
            $revision->previous_total = $evaluation->total_score;
            $revision->save();

            $evaluation->revision = $evaluation->revision + 1;
            $this->persist($evaluation, $version, $clean, EvaluationStatus::Submitted);

            $this->audit->log('evaluation.corrected', $evaluation, $this->summary($event, $evaluation) + ['reason' => $reason], $actor);

            $this->results->recalculate($event);

            return $evaluation;
        });
    }

    /** @return array{0: Event, 1: EvaluationFormVersion} */
    private function prepare(Event $event, Participant $participant, User $judge): array
    {
        $event = Event::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();

        if ($event->status !== EventStatus::InProgress) {
            throw ValidationException::withMessages(['event' => [__('Evaluations can only be submitted while the event is in progress.')]]);
        }

        $version = $event->formVersion()->with('criteria')->first();
        if (! $version) {
            throw ValidationException::withMessages(['event' => [__('This event has no evaluation form.')]]);
        }

        if ($judge->role !== Role::Judge || ! $judge->is_active) {
            throw ValidationException::withMessages(['judge' => [__('Only active judge accounts can submit evaluations.')]]);
        }
        if (! $event->judges()->where('users.id', $judge->id)->exists()) {
            throw ValidationException::withMessages(['judge' => [__('This judge is not assigned to this event.')]]);
        }

        if ($participant->event_id !== $event->id) {
            throw ValidationException::withMessages(['participant' => [__('This participant does not belong to this event.')]]);
        }
        if ($participant->status !== 'registered') {
            throw ValidationException::withMessages(['participant' => [__('Only registered participants can be scored.')]]);
        }

        return [$event, $version];
    }

    private function findOrNew(Event $event, Participant $participant, User $judge, EvaluationFormVersion $version): Evaluation
    {
        $evaluation = Evaluation::where('participant_id', $participant->id)->where('judge_id', $judge->id)->first();

        if (! $evaluation) {
            $evaluation = new Evaluation();
            $evaluation->event_id = $event->id;
            $evaluation->participant_id = $participant->id;
            $evaluation->judge_id = $judge->id;
            $evaluation->revision = 1;
        }

        $evaluation->evaluation_form_version_id = $version->id;

        return $evaluation;
    }

    private function assertNotSubmitted(Evaluation $evaluation): void
    {
        if ($evaluation->exists && $evaluation->status === EvaluationStatus::Submitted) {
            throw ValidationException::withMessages([
                'evaluation' => [__('This evaluation has already been submitted. Ask an administrator to correct it.')],
            ]);
        }
    }

    /** @param array<int, string> $clean */
    private function persist(Evaluation $evaluation, EvaluationFormVersion $version, array $clean, EvaluationStatus $status): void
    {
        $evaluation->status = $status;

        if ($status === EvaluationStatus::Submitted) {
            $total = $this->scoring->judgeTotal($version->is_weighted, $version->criteria, $clean);
            $evaluation->total_score = $total === null ? null : $this->scoring->decimal($this->scoring->round($total, 2));
            $evaluation->submitted_at = Carbon::now();
        } else {
            $evaluation->total_score = null;
            $evaluation->submitted_at = null;
        }

        $evaluation->save();

        EvaluationScore::where('evaluation_id', $evaluation->id)->delete();
        foreach ($clean as $criterionId => $score) {
            $row = new EvaluationScore();
            $row->evaluation_id = $evaluation->id;
            $row->evaluation_criterion_id = $criterionId;
            $row->score = $score;
            $row->save();
        }
    }

    /**
     * @param  array<int, string|int|float>  $scores
     * @return array<int, string> criterion id => score with two decimals
     */
    private function validateScores(EvaluationFormVersion $version, array $scores, bool $requireAll): array
    {
        $active = $version->criteria->where('is_active', true)->keyBy('id');
        $errors = [];
        $clean = [];

        foreach ($scores as $id => $value) {
            $key = "scores.{$id}";
            $criterion = $active->get((int) $id);

            if (! $criterion) {
                $errors[$key] = [__('This criterion is not part of the form.')];

                continue;
            }

            $text = is_string($value) ? trim($value) : ((is_int($value) || is_float($value)) ? (string) $value : '');
            if (! preg_match('/^\d+(\.\d{1,2})?$/', $text)) {
                $errors[$key] = [__('Enter a number with at most 2 decimals.')];

                continue;
            }

            $min = (string) $criterion->min_score;
            $max = (string) $criterion->max_score;
            if (bccomp($text, $min, 2) < 0 || bccomp($text, $max, 2) > 0) {
                $errors[$key] = [__('The score must be between :min and :max.', ['min' => $min, 'max' => $max])];

                continue;
            }

            $clean[(int) $id] = bcadd($text, '0', 2);
        }

        if ($requireAll) {
            foreach ($active as $id => $criterion) {
                if ($criterion->is_required && ! isset($clean[$id]) && ! isset($errors["scores.{$id}"])) {
                    $errors["scores.{$id}"] = [__('This criterion is required.')];
                }
            }
        }

        if ($errors === [] && $clean === []) {
            $errors['scores'] = [__('Enter at least one score.')];
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return $clean;
    }

    /** @return array<string, mixed> */
    private function summary(Event $event, Evaluation $evaluation): array
    {
        return [
            'event' => $event->code,
            'participant_id' => $evaluation->participant_id,
            'judge_id' => $evaluation->judge_id,
            'revision' => $evaluation->revision,
        ];
    }
}