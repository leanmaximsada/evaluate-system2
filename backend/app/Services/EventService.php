<?php

namespace App\Services;

use App\Enums\EventStatus;
use App\Models\Event;
use App\Models\Participant;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use App\Models\EvaluationForm;

class EventService
{
    private const DATE_FORMAT = 'Y-m-d\TH:i';

    public function __construct(private readonly AuditLogger $audit, private readonly SettingsService $settings) {}

    /** @param array<string, mixed> $data */
    public function create(array $data, User $actor): Event
    {
        return DB::transaction(function () use ($data, $actor) {
            $event = new Event(Arr::only($data, ['name', 'code', 'description', 'venue', 'category', 'timezone']));
            $this->applyDates($event, $data);
            $event->status = EventStatus::Draft;
            $event->created_by = $actor->id;
            $event->save();

            $this->audit->log('event.created', $event, ['code' => $event->code], $actor);

            return $event;
        });
    }

    /** @param array<string, mixed> $data */
    public function update(Event $event, array $data, User $actor): Event
    {
        return DB::transaction(function () use ($event, $data, $actor) {
            $event = $this->lock($event);

            if (in_array($event->status, [EventStatus::Completed, EventStatus::Cancelled], true)) {
                throw ValidationException::withMessages(['event' => [__('This event can no longer be edited.')]]);
            }

            $event->fill(Arr::only($data, ['name', 'code', 'description', 'venue', 'category', 'timezone']));
            $this->applyDates($event, $data);

            $locked = $event->status === EventStatus::InProgress || $event->evaluations()->exists();
            if ($locked) {
                $errors = [];
                foreach (['code', 'timezone', 'starts_at', 'ends_at'] as $field) {
                    if ($event->isDirty($field)) {
                        $errors[$field] = [__('This field cannot be changed once the event has started or has scores.')];
                    }
                }
                if ($errors !== []) {
                    throw ValidationException::withMessages($errors);
                }
            }

            $changed = array_keys($event->getDirty());
            $event->save();

            if ($changed !== []) {
                $this->audit->log('event.updated', $event, ['fields' => $changed], $actor);
            }

            return $event;
        });
    }

    public function changeStatus(Event $event, EventStatus $to, User $actor): Event
    {
        return DB::transaction(function () use ($event, $to, $actor) {
            $event = $this->lock($event);
            $from = $event->status;

            if (! $from->canTransitionTo($to)) {
                throw ValidationException::withMessages(['status' => [__('This status change is not allowed.')]]);
            }

            if ($to === EventStatus::InProgress) {
                $activeParticipants = Participant::where('event_id', $event->id)->where('status', 'registered')->exists();
                if (! $activeParticipants) {
                    throw ValidationException::withMessages(['status' => [__('Add at least one active participant before starting the event.')]]);
                }
                if (! $event->judges()->exists()) {
                    throw ValidationException::withMessages(['status' => [__('Assign at least one judge before starting the event.')]]);
                }
                if (! $event->evaluation_form_version_id) {
                    throw ValidationException::withMessages(['status' => [__('Assign an evaluation form before starting the event.')]]);
                }

                $event->scoring_policy = $this->policySnapshot($event);
            }

            $event->status = $to;
            $event->save();

            $this->audit->log('event.status_changed', $event, ['from' => $from->value, 'to' => $to->value], $actor);

            return $event;
        });
    }

    /** Frozen copy of the scoring defaults, so later settings changes cannot alter a running event. */
    private function policySnapshot(Event $event): array
    {
        $e = $this->settings->all()['evaluation'];

        return [
            'min_score' => $e['min_score'],
            'max_score' => $e['max_score'],
            'score_precision' => $e['score_precision'],
            'tie_policy' => $e['tie_policy'],
            'show_tie_indicator' => $e['show_tie_indicator'],
            'aggregation' => 'mean',
            'missing_scores' => 'exclude',
            'form_version_id' => $event->evaluation_form_version_id,
            'frozen_at' => Carbon::now()->toIso8601String(),
        ];
    }

        /** Pins the latest published version of the form to the event. */
    public function assignForm(Event $event, EvaluationForm $form, User $actor): Event
    {
        return DB::transaction(function () use ($event, $form, $actor) {
            $event = $this->lockForForm($event);
            $version = $form->status->value === 'active'
                ? $form->versions()->reorder('version_number', 'desc')->where('status', 'published')->first()
                : null;

            if (! $version) {
                throw ValidationException::withMessages(['form_id' => [__('Choose an active form that has a published version.')]]);
            }

            $event->evaluation_form_version_id = $version->id;
            $event->save();

            $this->audit->log('event.form_assigned', $event, ['form' => $form->name, 'version' => $version->version_number], $actor);

            return $event;
        });
    }

    public function clearForm(Event $event, User $actor): Event
    {
        return DB::transaction(function () use ($event, $actor) {
            $event = $this->lockForForm($event);
            $event->evaluation_form_version_id = null;
            $event->save();

            $this->audit->log('event.form_cleared', $event, [], $actor);

            return $event;
        });
    }

    private function lockForForm(Event $event): Event
    {
        $event = $this->lock($event);

        if (! in_array($event->status, [EventStatus::Draft, EventStatus::Upcoming], true)) {
            throw ValidationException::withMessages(['event' => [__('The evaluation form can only be changed before the event starts.')]]);
        }
        if ($event->evaluations()->exists()) {
            throw ValidationException::withMessages(['event' => [__('This event has scores, so its form cannot be changed.')]]);
        }

        return $event;
    }

    private function applyDates(Event $event, array $data): void
    {
        $tz = $event->timezone;
        $event->starts_at = Carbon::createFromFormat(self::DATE_FORMAT, $data['starts_at'], $tz)->utc();
        $event->ends_at = Carbon::createFromFormat(self::DATE_FORMAT, $data['ends_at'], $tz)->utc();
    }

    private function lock(Event $event): Event
    {
        return Event::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();
    }
}