<?php

namespace App\Services;

use App\Enums\EventStatus;
use App\Enums\Role;
use App\Models\Evaluation;
use App\Models\Event;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class JudgeAssignmentService
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function assign(Event $event, User $judge, User $actor): User
    {
        return DB::transaction(function () use ($event, $judge, $actor) {
            $event = $this->lock($event);
            $this->assertOpen($event);

            if ($judge->role !== Role::Judge || ! $judge->is_active) {
                throw ValidationException::withMessages(['user_id' => [__('Only active judge accounts can be assigned.')]]);
            }
            if ($event->judges()->where('users.id', $judge->id)->exists()) {
                throw ValidationException::withMessages(['user_id' => [__('This judge is already assigned.')]]);
            }

            $event->judges()->attach($judge->id, ['assigned_by' => $actor->id]);
            $this->audit->log('judge.assigned', $event, ['event' => $event->code, 'judge_id' => $judge->id], $actor);

            return $event->judges()->where('users.id', $judge->id)->firstOrFail();
        });
    }

    public function unassign(Event $event, User $judge, User $actor): void
    {
        DB::transaction(function () use ($event, $judge, $actor) {
            $event = $this->lock($event);
            $this->assertOpen($event);

            if (! $event->judges()->where('users.id', $judge->id)->exists()) {
                throw ValidationException::withMessages(['user_id' => [__('This judge is not assigned to this event.')]]);
            }
            if (Evaluation::where('event_id', $event->id)->where('judge_id', $judge->id)->exists()) {
                throw ValidationException::withMessages(['user_id' => [__('This judge has submitted evaluations and cannot be removed.')]]);
            }

            $event->judges()->detach($judge->id);
            $this->audit->log('judge.unassigned', $event, ['event' => $event->code, 'judge_id' => $judge->id], $actor);
        });
    }

    /** @return Collection<int, User> Active judges not yet assigned to this event. */
    public function candidates(Event $event, ?string $search): Collection
    {
        return User::query()
            ->where('role', Role::Judge->value)
            ->where('is_active', true)
            ->whereNotIn('id', $event->judges()->select('users.id'))
            ->when($search, function ($q, string $term) {
                $like = '%'.addcslashes($term, '\\%_').'%';
                $q->where(fn ($q) => $q->where('name', 'ilike', $like)->orWhere('email', 'ilike', $like));
            })
            ->orderBy('name')
            ->limit(20)
            ->get();
    }

    private function assertOpen(Event $event): void
    {
        if (in_array($event->status, [EventStatus::Completed, EventStatus::Cancelled], true)) {
            throw ValidationException::withMessages(['event' => [__('Judges cannot be changed on a completed or cancelled event.')]]);
        }
    }

    private function lock(Event $event): Event
    {
        return Event::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();
    }
}