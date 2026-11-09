<?php

namespace App\Services;

use App\Enums\EventStatus;
use App\Events\PublicResultsChanged;
use App\Models\Event;
use App\Models\ResultPublication;
use App\Models\User;
use App\Support\SafeBroadcast;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * How an event looks on the public screen: organization, subtitle, default visibility and the preview.
 * Scores and ranks are never edited here. They come from the scoring engine.
 */
class EventDisplayService
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly ResultService $results,
        private readonly ResultPublicationService $publications,
        private readonly SponsorService $sponsors,
    ) {}

    /** @param array<string, mixed> $data Only the keys that are present are changed. */
    public function update(Event $event, array $data, User $actor): Event
    {
        return DB::transaction(function () use ($event, $data, $actor) {
            $event = Event::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();

            if (array_key_exists('public_subtitle', $data)) {
                $clean = $data['public_subtitle'] === null ? null : trim((string) preg_replace('/\R/u', "\n", (string) $data['public_subtitle']));
                $event->public_subtitle = ($clean === null || $clean === '') ? null : $clean;
            }
            if (array_key_exists('organization_name', $data)) {
                $name = $data['organization_name'] === null ? null : trim((string) $data['organization_name']);
                $event->organization_name = ($name === null || $name === '') ? null : $name;
            }
            if (array_key_exists('display_visibility', $data)) {
                $event->display_visibility = $data['display_visibility'];
            }

            if ($event->isDirty()) {
                $fields = array_keys($event->getDirty());
                $event->save();
                $this->audit->log('event.display_updated', $event, ['event' => $event->code, 'fields' => $fields], $actor);
                $this->announce($event);
            }

            return $event;
        });
    }

    public function setLogo(Event $event, UploadedFile $logo, User $actor): Event
    {
        $newPath = null;
        $oldPath = null;

        try {
            $result = DB::transaction(function () use ($event, $logo, $actor, &$newPath, &$oldPath) {
                $event = Event::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();

                $oldPath = $event->organization_logo_path;
                $newPath = $logo->store("organization/{$event->id}", 'public');
                $event->organization_logo_path = $newPath;
                $event->save();

                $this->audit->log('event.organization_logo_updated', $event, ['event' => $event->code], $actor);
                $this->announce($event);

                return $event;
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

    public function removeLogo(Event $event, User $actor): Event
    {
        $oldPath = null;

        $result = DB::transaction(function () use ($event, $actor, &$oldPath) {
            $event = Event::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();

            $oldPath = $event->organization_logo_path;
            if ($oldPath === null) {
                return $event;
            }

            $event->organization_logo_path = null;
            $event->save();

            $this->audit->log('event.organization_logo_removed', $event, ['event' => $event->code], $actor);
            $this->announce($event);

            return $event;
        });

        if ($oldPath !== null) {
            Storage::disk('public')->delete($oldPath);
        }

        return $result;
    }

    /**
     * The public screen as it would look right now, built from the current results with the same code
     * that builds a publication, so the preview and the published version cannot drift apart.
     * Read-only: nothing is recalculated, saved or announced.
     *
     * @return array<string, mixed>
     */
    public function preview(Event $event): array
    {
        $rows = $this->results->rows($event);
        $visibility = $event->display_visibility;
        $policy = $this->results->policyFor($event);
        $active = $this->publications->active($event);
        $sponsors = $this->sponsors->publicList($event);

        $registered = array_filter($rows, fn (array $r) => $r['participant_status'] === 'registered');
        $completed = $event->status === EventStatus::Completed;

        return [
            'event' => ['name' => $event->name, 'code' => $event->code, 'status' => $event->status->value, 'subtitle' => $event->public_subtitle],
            'is_final' => $completed,
            'visibility' => $visibility,
            'show_tie_indicator' => (bool) ($policy['show_tie_indicator'] ?? true),
            'revision' => $active?->revision,
            'published_at' => $active?->published_at?->toIso8601String(),
            'organization' => $event->publicOrganization(),
            'sponsors' => $sponsors,
            'rows' => $this->publications->snapshotRows($rows, $visibility),
            'is_preview' => true,
            'checks' => [
                'event_completed' => $completed,
                'ranked_participants' => count(array_filter($rows, fn (array $r) => $r['rank'] !== null)),
                'incomplete_evaluations' => count(array_filter($registered, fn (array $r) => ! $r['is_complete'])),
                'sponsors_count' => count($sponsors),
                'has_organization' => $event->publicOrganization() !== null,
                'has_organization_logo' => $event->organization_logo_path !== null,
                'has_subtitle' => $event->public_subtitle !== null,
                'is_published' => $active !== null,
                'has_previous_publication' => ResultPublication::where('event_id', $event->id)->exists(),
            ],
        ];
    }

    /** Live public screens re-fetch when the display changes, but only while results are published. */
    private function announce(Event $event): void
    {
        $publication = $this->publications->active($event);

        if ($publication) {
            SafeBroadcast::afterCommit(new PublicResultsChanged($event->code, 'published', $publication->revision));
        }
    }
}