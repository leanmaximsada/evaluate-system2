<?php

namespace App\Services;

use App\Enums\EventStatus;
use App\Models\Event;
use App\Models\Participant;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ParticipantService
{
    /** Participants can be added or removed only before the event starts. */
    private const STRUCTURAL = [EventStatus::Draft, EventStatus::Upcoming];

    /** Participants can still be edited or reordered while the event runs. */
    private const EDITABLE = [EventStatus::Draft, EventStatus::Upcoming, EventStatus::InProgress];

    public function __construct(private readonly AuditLogger $audit, private readonly ResultService $results) {}
    /** @param array<string, mixed> $data */
    public function create(Event $event, array $data, User $actor): Participant
    {
        return DB::transaction(function () use ($event, $data, $actor) {
            $event = $this->lock($event);
            $this->assertStatus($event, self::STRUCTURAL, 'Participants can only be added or removed before the event starts.');

            $participant = new Participant(Arr::only($data, ['name', 'number', 'team_name', 'description']));
            $participant->event_id = $event->id;
            $participant->presentation_order = (int) Participant::where('event_id', $event->id)->max('presentation_order') + 1;
            $participant->status = $data['status'] ?? 'registered';
            $participant->save();

            $this->audit->log('participant.created', $participant, ['event' => $event->code, 'number' => $participant->number], $actor);

            return $participant;
        });
    }

    /** @param array<string, mixed> $data */
    /** @param array<string, mixed> $data */
    public function update(Event $event, Participant $participant, array $data, User $actor): Participant
    {
        return DB::transaction(function () use ($event, $participant, $data, $actor) {
            $event = $this->lock($event);
            $this->assertStatus($event, self::EDITABLE, 'This event is closed, so participants cannot be changed.');

            $participant->fill(Arr::only($data, ['name', 'number', 'team_name', 'description']));
            if (isset($data['status'])) {
                $participant->status = $data['status'];
            }

            $changed = array_keys($participant->getDirty());
            $participant->save();

            if ($changed !== []) {
                $this->audit->log('participant.updated', $participant, ['event' => $event->code, 'fields' => $changed], $actor);
            }

            // Withdrawing, disqualifying or re-registering someone changes the ranking.
            if (in_array('status', $changed, true)) {
                $this->results->recalculate($event);
            }

            return $participant;
        });
    }

    public function delete(Event $event, Participant $participant, User $actor): void
    {
        DB::transaction(function () use ($event, $participant, $actor) {
            $event = $this->lock($event);
            $this->assertStatus($event, self::STRUCTURAL, 'Participants can only be added or removed before the event starts.');

            if ($participant->evaluations()->exists()) {
                throw ValidationException::withMessages(['participant' => [__('This participant has scores and cannot be removed. Withdraw them instead.')]]);
            }

            $number = $participant->number;
            $participant->delete();
            $this->renumber($event);

            $this->audit->log('participant.deleted', null, ['event' => $event->code, 'number' => $number], $actor);
        });
    }

    /** @param list<int> $ids Participant ids in the new presentation order. */
    public function reorder(Event $event, array $ids, User $actor): void
    {
        DB::transaction(function () use ($event, $ids, $actor) {
            $event = $this->lock($event);
            $this->assertStatus($event, self::EDITABLE, 'This event is closed, so participants cannot be changed.');

            $existing = Participant::where('event_id', $event->id)->pluck('id')->all();
            $given = array_map('intval', $ids);
            sort($existing);
            $sorted = $given;
            sort($sorted);

            if ($existing !== $sorted) {
                throw ValidationException::withMessages(['order' => [__('The order must list every participant of this event exactly once.')]]);
            }

            // The unique (event_id, presentation_order) constraint is deferred, so positions can swap inside this transaction.
            foreach ($given as $index => $id) {
                Participant::where('id', $id)->update(['presentation_order' => $index + 1]);
            }

            $this->audit->log('participant.reordered', $event, ['count' => count($given)], $actor);
        });
    }

    private function renumber(Event $event): void
    {
        $ids = Participant::where('event_id', $event->id)->orderBy('presentation_order')->pluck('id');
        foreach ($ids as $index => $id) {
            Participant::where('id', $id)->update(['presentation_order' => $index + 1]);
        }
    }

    /** @param list<EventStatus> $allowed */
    private function assertStatus(Event $event, array $allowed, string $message): void
    {
        if (! in_array($event->status, $allowed, true)) {
            throw ValidationException::withMessages(['event' => [__($message)]]);
        }
    }

    private function lock(Event $event): Event
    {
        return Event::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();
                    if (in_array('status', $changed, true)) {
                $this->results->recalculate($event);
            }
    }
}