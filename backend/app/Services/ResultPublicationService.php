<?php

namespace App\Services;

use App\Enums\EventStatus;
use App\Models\Event;
use App\Models\ResultPublication;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Publishing freezes a copy of the public ranking. A published snapshot is never edited:
 * changes go through unpublish and republish with a correction reason (a new revision).
 */
class ResultPublicationService
{
    public function __construct(private readonly ResultService $results, private readonly AuditLogger $audit) {}

    public function active(Event $event): ?ResultPublication
    {
        return ResultPublication::where('event_id', $event->id)->where('status', 'published')->first();
    }

    /** @param array{visibility: string, correction_reason?: ?string, accept_incomplete?: bool} $data */
    public function publish(Event $event, array $data, User $actor): ResultPublication
    {
        return DB::transaction(function () use ($event, $data, $actor) {
            $event = Event::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();

            if ($event->status !== EventStatus::Completed) {
                throw ValidationException::withMessages(['event' => [__('Results can only be published after the event is completed.')]]);
            }
            if ($this->active($event)) {
                throw ValidationException::withMessages(['publication' => [__('This event already has published results. Unpublish them first, then republish with a correction reason.')]]);
            }

            $this->results->recalculate($event);
            $rows = $this->results->rows($event);

            if (array_filter($rows, fn (array $r) => $r['rank'] !== null) === []) {
                throw ValidationException::withMessages(['results' => [__('There are no ranked participants to publish.')]]);
            }

            $incomplete = count(array_filter($rows, fn (array $r) => $r['participant_status'] === 'registered' && ! $r['is_complete']));
            if ($incomplete > 0 && empty($data['accept_incomplete'])) {
                throw ValidationException::withMessages(['results' => [__(':count participants have incomplete evaluations. Review them, or confirm to publish anyway.', ['count' => $incomplete])]]);
            }

            $previous = ResultPublication::where('event_id', $event->id)->max('revision');
            $reason = trim((string) ($data['correction_reason'] ?? ''));
            if ($previous !== null && $reason === '') {
                throw ValidationException::withMessages(['correction_reason' => [__('A correction reason is required when republishing.')]]);
            }

            $policy = $this->results->policyFor($event);

            $publication = new ResultPublication();
            $publication->event_id = $event->id;
            $publication->revision = (int) $previous + 1;
            $publication->status = 'published';
            $publication->snapshot = [
                'meta' => [
                    'is_final' => true,
                    'visibility' => $data['visibility'],
                    'tie_policy' => $policy['tie_policy'],
                    'score_precision' => $policy['score_precision'],
                    'event_name' => $event->name,
                    'event_code' => $event->code,
                ],
                'rows' => $this->snapshotRows($rows, $data['visibility']),
            ];
            $publication->published_by = $actor->id;
            $publication->published_at = Carbon::now();
            $publication->correction_reason = $reason !== '' ? $reason : null;
            $publication->save();

            $this->audit->log('results.published', $event, [
                'event' => $event->code,
                'revision' => $publication->revision,
                'visibility' => $data['visibility'],
                'incomplete_accepted' => $incomplete,
                'correction_reason' => $publication->correction_reason,
            ], $actor);

            return $publication;
        });
    }

    public function unpublish(Event $event, ?string $reason, User $actor): ResultPublication
    {
        return DB::transaction(function () use ($event, $reason, $actor) {
            $event = Event::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();

            $publication = ResultPublication::where('event_id', $event->id)->where('status', 'published')->lockForUpdate()->first();
            if (! $publication) {
                throw ValidationException::withMessages(['publication' => [__('These results are not currently published.')]]);
            }

            $publication->status = 'unpublished';
            $publication->unpublished_by = $actor->id;
            $publication->unpublished_at = Carbon::now();
            $publication->save();

            $this->audit->log('results.unpublished', $event, [
                'event' => $event->code,
                'revision' => $publication->revision,
                'reason' => $reason,
            ], $actor);

            return $publication;
        });
    }

    /**
     * Only public fields. Judge identities, per-criterion scores and unranked participants never appear.
     *
     * @param  list<array<string, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    public function snapshotRows(array $rows, string $visibility): array
    {
        $out = [];

        foreach ($rows as $row) {
            if ($row['rank'] === null) {
                continue;
            }

            $item = [
                'number' => $row['number'],
                'name' => $row['name'],
                'team_name' => $row['team_name'],
                'rank' => $row['rank'],
                'tied' => $row['is_tied'],
            ];
            if ($visibility === 'rank_and_score') {
                $item['score'] = $row['aggregate_score'];
            }

            $out[] = $item;
        }

        return $out;
    }

    /**
     * @param  list<array<string, mixed>>  $rows  current results
     * @return array<string, mixed>
     */
    public function summary(Event $event, array $rows): array
    {
        $latest = ResultPublication::where('event_id', $event->id)->with('publisher:id,name')->orderByDesc('revision')->first();

        if (! $latest) {
            return ['status' => 'none', 'revision' => null, 'visibility' => null, 'is_final' => false, 'published_at' => null,
                'published_by' => null, 'unpublished_at' => null, 'needs_republish' => false];
        }

        $visibility = $latest->snapshot['meta']['visibility'] ?? 'rank_and_score';
        $active = $latest->status === 'published';

        return [
            'status' => $latest->status,
            'revision' => $latest->revision,
            'visibility' => $visibility,
            'is_final' => (bool) ($latest->snapshot['meta']['is_final'] ?? false),
            'published_at' => $latest->published_at?->toIso8601String(),
            'published_by' => $latest->publisher?->name,
            'unpublished_at' => $latest->unpublished_at?->toIso8601String(),
            // Loose comparison on purpose: PostgreSQL jsonb does not keep key order.
            'needs_republish' => $active && $this->snapshotRows($rows, $visibility) != ($latest->snapshot['rows'] ?? []),
        ];
    }

    /** @return array<string, mixed> */
    public function present(ResultPublication $publication, bool $withRows = false): array
    {
        $publication->loadMissing('publisher:id,name');

        return array_filter([
            'revision' => $publication->revision,
            'status' => $publication->status,
            'visibility' => $publication->snapshot['meta']['visibility'] ?? null,
            'is_final' => (bool) ($publication->snapshot['meta']['is_final'] ?? false),
            'published_at' => $publication->published_at?->toIso8601String(),
            'published_by' => $publication->publisher?->name,
            'unpublished_at' => $publication->unpublished_at?->toIso8601String(),
            'correction_reason' => $publication->correction_reason,
            'rows_count' => count($publication->snapshot['rows'] ?? []),
            'rows' => $withRows ? ($publication->snapshot['rows'] ?? []) : null,
        ], fn ($value) => $value !== null);
    }
}