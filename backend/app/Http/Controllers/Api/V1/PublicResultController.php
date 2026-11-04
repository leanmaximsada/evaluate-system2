<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\ResultPublication;
use App\Services\ResultService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class PublicResultController extends Controller
{
    public function __construct(private readonly ResultService $results) {}

    public function show(string $eventCode): JsonResponse
    {
        $event = Event::query()->where('code', Str::upper($eventCode))->first();
        $publication = $event
            ? ResultPublication::where('event_id', $event->id)->where('status', 'published')->first()
            : null;

        // Same answer for "no such event" and "not published", so event codes cannot be probed.
        abort_if($publication === null, 404, __('Results are not published.'));

        $meta = $publication->snapshot['meta'] ?? [];
        $policy = $this->results->policyFor($event);

        return response()->json(['data' => [
            'event' => ['name' => $event->name, 'code' => $event->code, 'status' => $event->status->value],
            'is_final' => (bool) ($meta['is_final'] ?? false),
            'visibility' => $meta['visibility'] ?? 'rank_and_score',
            'show_tie_indicator' => (bool) ($policy['show_tie_indicator'] ?? true),
            'revision' => $publication->revision,
            'published_at' => $publication->published_at?->toIso8601String(),
            // The frozen snapshot: number, name, team, rank, tie flag and (if allowed) score. Nothing else.
            'rows' => $publication->snapshot['rows'] ?? [],
        ]])->header('Cache-Control', 'no-store');
    }
}