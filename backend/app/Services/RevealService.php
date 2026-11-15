<?php

namespace App\Services;

use App\Events\PublicResultsChanged;
use App\Models\Event;
use App\Models\ResultPublication;
use App\Models\User;
use App\Support\SafeBroadcast;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Step-by-step reveal of a published ranking. Hidden rows are removed on the server before the
 * public response is built, so nothing can be read early from the browser.
 */
class RevealService
{
    public function __construct(private readonly ResultPublicationService $publications, private readonly AuditLogger $audit) {}

    /**
     * Hidden places, last place first. Tied rows share a step.
     *
     * @return list<array{rank: int, rows: list<array<string, mixed>>}>
     */
    public function steps(ResultPublication $publication): array
    {
        $top = (int) $publication->reveal_top;
        $groups = [];

        foreach ($publication->snapshot['rows'] ?? [] as $row) {
            if ((int) $row['rank'] <= $top) {
                $groups[(int) $row['rank']][] = $row;
            }
        }

        krsort($groups);

        $steps = [];
        foreach ($groups as $rank => $rows) {
            $steps[] = ['rank' => (int) $rank, 'rows' => $rows];
        }

        return $steps;
    }

    /** The rows the public may see right now. Everything, unless reveal mode is on and incomplete. */
    public function visibleRows(ResultPublication $publication): array
    {
        $rows = $publication->snapshot['rows'] ?? [];

        if (! $publication->reveal_enabled) {
            return $rows;
        }

        $hidden = [];
        foreach (array_slice($this->steps($publication), (int) $publication->revealed_count) as $step) {
            $hidden[$step['rank']] = true;
        }

        return array_values(array_filter($rows, fn (array $row) => ! isset($hidden[(int) $row['rank']])));
    }

    /** @return array{enabled: bool, total_steps: int, revealed_steps: int, complete: bool}|null Counts only. */
    public function publicState(ResultPublication $publication): ?array
    {
        if (! $publication->reveal_enabled) {
            return null;
        }

        $total = count($this->steps($publication));
        $done = min($total, (int) $publication->revealed_count);

        return ['enabled' => true, 'total_steps' => $total, 'revealed_steps' => $done, 'complete' => $done >= $total];
    }

    /** What the presenter sees: every step, including the hidden ones. Administrators only. */
    public function adminState(Event $event): array
    {
        $publication = $this->publications->active($event);

        if (! $publication) {
            return ['published' => false, 'enabled' => false, 'revision' => null, 'reveal_top' => 0,
                'total_steps' => 0, 'revealed_steps' => 0, 'complete' => false, 'steps' => []];
        }

        $steps = $this->steps($publication);
        $done = min(count($steps), (int) $publication->revealed_count);

        return [
            'published' => true,
            'enabled' => (bool) $publication->reveal_enabled,
            'revision' => $publication->revision,
            'reveal_top' => (int) $publication->reveal_top,
            'total_steps' => $publication->reveal_enabled ? count($steps) : 0,
            'revealed_steps' => $done,
            'complete' => (bool) $publication->reveal_enabled && $done >= count($steps),
            'steps' => $publication->reveal_enabled ? array_map(fn (array $step, int $index) => [
                'rank' => $step['rank'],
                'revealed' => $index < $done,
                'rows' => array_map(fn (array $row) => array_filter([
                    'number' => $row['number'], 'name' => $row['name'], 'team_name' => $row['team_name'] ?? null, 'score' => $row['score'] ?? null,
                ], fn ($value) => $value !== null), $step['rows']),
            ], $steps, array_keys($steps)) : [],
        ];
    }

    /** @param 'next'|'undo'|'all'|'reset' $action */
    public function apply(Event $event, string $action, User $actor): void
    {
        DB::transaction(function () use ($event, $action, $actor) {
            $event = Event::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();

            $publication = ResultPublication::where('event_id', $event->id)->where('status', 'published')->lockForUpdate()->first();
            if (! $publication) {
                throw ValidationException::withMessages(['publication' => [__('These results are not currently published.')]]);
            }
            if (! $publication->reveal_enabled) {
                throw ValidationException::withMessages(['reveal' => [__('Reveal mode is not turned on for these results.')]]);
            }

            $total = count($this->steps($publication));
            $current = min($total, (int) $publication->revealed_count);

            $next = match ($action) {
                'next' => $current < $total ? $current + 1 : throw ValidationException::withMessages(['reveal' => [__('Everything is already revealed.')]]),
                'undo' => $current > 0 ? $current - 1 : throw ValidationException::withMessages(['reveal' => [__('Nothing has been revealed yet.')]]),
                'all' => $total,
                default => 0,
            };

            if ($next === $current) {
                return;
            }

            $publication->revealed_count = $next;
            $publication->save();

            $this->audit->log("results.reveal_{$action}", $event, [
                'event' => $event->code, 'revision' => $publication->revision, 'revealed_steps' => $next, 'total_steps' => $total,
            ], $actor);

            SafeBroadcast::afterCommit(new PublicResultsChanged($event->code, 'published', $publication->revision));
        });
    }
}