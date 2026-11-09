<?php

namespace App\Services;

use App\Enums\SponsorTier;
use App\Events\PublicResultsChanged;
use App\Models\Event;
use App\Models\EventSponsor;
use App\Models\User;
use App\Support\SafeBroadcast;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

class SponsorService
{
    public const MAX_PER_EVENT = 40;

    public function __construct(private readonly AuditLogger $audit, private readonly ResultPublicationService $publications) {}

    /** @return Collection<int, EventSponsor> Ordered by level, then by the order chosen by the administrator. */
    public function all(Event $event): Collection
    {
        return EventSponsor::where('event_id', $event->id)->get()
            ->sort(fn (EventSponsor $a, EventSponsor $b) => [$a->tier->rank(), $a->display_order, $a->id] <=> [$b->tier->rank(), $b->display_order, $b->id])
            ->values();
    }

    /** @param array<string, mixed> $data */
    public function create(Event $event, array $data, UploadedFile $logo, User $actor): EventSponsor
    {
        $path = null;

        try {
            return DB::transaction(function () use ($event, $data, $logo, $actor, &$path) {
                $event = Event::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();

                if (EventSponsor::where('event_id', $event->id)->count() >= self::MAX_PER_EVENT) {
                    throw ValidationException::withMessages(['sponsor' => [__('An event can have at most 40 sponsors.')]]);
                }

                $path = $logo->store("sponsors/{$event->id}", 'public');

                $sponsor = new EventSponsor();
                $sponsor->event_id = $event->id;
                $sponsor->name = $data['name'];
                $sponsor->tier = SponsorTier::from($data['tier']);
                $sponsor->logo_path = $path;
                $sponsor->display_order = (int) EventSponsor::where('event_id', $event->id)->max('display_order') + 1;
                $sponsor->save();

                $this->audit->log('sponsor.created', $event, ['event' => $event->code, 'name' => $sponsor->name, 'tier' => $sponsor->tier->value], $actor);
                $this->announce($event);

                return $sponsor;
            });
        } catch (Throwable $e) {
            if ($path !== null) {
                Storage::disk('public')->delete($path);
            }
            throw $e;
        }
    }

    /** @param array<string, mixed> $data */
    public function update(Event $event, EventSponsor $sponsor, array $data, ?UploadedFile $logo, User $actor): EventSponsor
    {
        $newPath = null;
        $oldPath = null;

        try {
            $result = DB::transaction(function () use ($event, $sponsor, $data, $logo, $actor, &$newPath, &$oldPath) {
                $event = Event::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();

                $sponsor->name = $data['name'];
                $sponsor->tier = SponsorTier::from($data['tier']);

                if ($logo) {
                    $oldPath = $sponsor->logo_path;
                    $newPath = $logo->store("sponsors/{$event->id}", 'public');
                    $sponsor->logo_path = $newPath;
                }

                $changed = array_keys($sponsor->getDirty());
                $sponsor->save();

                if ($changed !== []) {
                    $this->audit->log('sponsor.updated', $event, ['event' => $event->code, 'name' => $sponsor->name, 'fields' => $changed], $actor);
                    $this->announce($event);
                }

                return $sponsor;
            });
        } catch (Throwable $e) {
            if ($newPath !== null) {
                Storage::disk('public')->delete($newPath);
            }
            throw $e;
        }

        if ($oldPath !== null) {
            Storage::disk('public')->delete($oldPath);
        }

        return $result;
    }

    public function delete(Event $event, EventSponsor $sponsor, User $actor): void
    {
        $path = $sponsor->logo_path;

        DB::transaction(function () use ($event, $sponsor, $actor) {
            $event = Event::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();
            $name = $sponsor->name;
            $sponsor->delete();

            $this->audit->log('sponsor.deleted', $event, ['event' => $event->code, 'name' => $name], $actor);
            $this->announce($event);
        });

        Storage::disk('public')->delete($path);
    }

    /** @param list<int> $ids Every sponsor of the event, in the new order. */
    public function reorder(Event $event, array $ids, User $actor): void
    {
        DB::transaction(function () use ($event, $ids, $actor) {
            $event = Event::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();

            $existing = EventSponsor::where('event_id', $event->id)->pluck('id')->all();
            $given = array_map('intval', $ids);
            $sorted = $given;
            sort($existing);
            sort($sorted);

            if ($existing !== $sorted) {
                throw ValidationException::withMessages(['order' => [__('The order must list every sponsor exactly once.')]]);
            }

            foreach ($given as $index => $id) {
                EventSponsor::where('id', $id)->update(['display_order' => $index + 1]);
            }

            $this->audit->log('sponsor.reordered', $event, ['event' => $event->code], $actor);
            $this->announce($event);
        });
    }

    /** @return list<array{tier: string, name: string, logo_url: string}> Public fields only. */
    public function publicList(Event $event): array
    {
        return $this->all($event)->map(fn (EventSponsor $s) => [
            'tier' => $s->tier->value,
            'name' => $s->name,
            'logo_url' => $s->logoUrl(),
        ])->values()->all();
    }

    /** Public screens re-fetch when sponsors or display text change, but only if results are live. */
    private function announce(Event $event): void
    {
        $publication = $this->publications->active($event);

        if ($publication) {
            SafeBroadcast::afterCommit(new PublicResultsChanged($event->code, 'published', $publication->revision));
        }
    }
}