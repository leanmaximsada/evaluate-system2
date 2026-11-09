<?php

namespace Tests\Feature\Events;

use App\Enums\EventStatus;
use App\Events\PublicResultsChanged;
use App\Models\AuditLog;
use App\Models\EvaluationFormVersion;
use App\Models\Event;
use App\Models\Participant;
use App\Models\ParticipantResult;
use App\Models\ResultPublication;
use App\Models\User;
use App\Services\EvaluationService;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event as EventFacade;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreatesForms;
use Tests\Concerns\CreatesScoringFixtures;
use Tests\TestCase;

class EventDisplayTest extends TestCase
{
    use RefreshDatabase, CreatesForms, CreatesScoringFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    private function actor(User $user): static
    {
        return $this->spa()->actingAs($user, 'sanctum');
    }

    private function disk(): FilesystemAdapter
    {
        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('public');

        return $disk;
    }

    private function png(string $name = 'logo.png'): UploadedFile
    {
        // A real 1x1 PNG, so the GD extension is not needed.
        return UploadedFile::fake()->createWithContent($name, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='));
    }

    private function submit(Event $event, EvaluationFormVersion $version, Participant $participant, User $judge, int $score): void
    {
        app(EvaluationService::class)->submit($event, $participant, $judge, $this->scoreMap($version, [$score]), $judge);
    }

    /** @return array{0: Event, 1: User} Completed and not published; three participants scored 90, 80 and 70. */
    private function finished(): array
    {
        [$event, $version, $people, $judges, $admin] = $this->scoringEvent(3, 1, [100]);
        foreach ([90, 80, 70] as $i => $score) {
            $this->submit($event, $version, $people[$i], $judges[0], $score);
        }
        $event->forceFill(['status' => EventStatus::Completed])->save();

        return [$event, $admin];
    }

    private function publish(Event $event, User $admin, string $visibility = 'rank_and_score'): void
    {
        $this->actor($admin)->postJson("/api/v1/events/{$event->id}/results/publish", ['visibility' => $visibility, 'confirm' => true])->assertCreated();
    }

    private function previewUrl(Event $event): string
    {
        return "/api/v1/events/{$event->id}/results/preview";
    }

    private function displayUrl(Event $event): string
    {
        return "/api/v1/events/{$event->id}/display";
    }

    public function test_permissions(): void
    {
        [$event, $admin] = $this->finished();
        $judge = User::factory()->judge()->create();

        $this->getJson($this->previewUrl($event))->assertUnauthorized();
        $this->actor($judge)->getJson($this->previewUrl($event))->assertForbidden();
        $this->actor($judge)->patchJson($this->displayUrl($event), ['organization_name' => 'X'])->assertForbidden();
        $this->actor($judge)->post($this->displayUrl($event).'/logo', ['logo' => $this->png()], ['Accept' => 'application/json'])->assertForbidden();

        $this->actor($admin)->getJson($this->previewUrl($event))->assertOk();
    }

    public function test_the_preview_shows_current_results_before_anything_is_public(): void
    {
        [$event, $version, $people, $judges, $admin] = $this->scoringEvent(3, 1, [100]);
        $this->submit($event, $version, $people[0], $judges[0], 90);
        $this->submit($event, $version, $people[1], $judges[0], 80);

        $this->actor($admin)->getJson($this->previewUrl($event))
            ->assertOk()
            ->assertJsonPath('data.is_preview', true)
            ->assertJsonPath('data.is_final', false)
            ->assertJsonPath('data.visibility', 'rank_and_score')
            ->assertJsonCount(2, 'data.rows')
            ->assertJsonPath('data.rows.0.score', '90.00')
            ->assertJsonPath('data.checks.event_completed', false)
            ->assertJsonPath('data.checks.ranked_participants', 2)
            ->assertJsonPath('data.checks.incomplete_evaluations', 1)
            ->assertJsonPath('data.checks.is_published', false);

        $this->getJson("/api/v1/public/events/{$event->code}/results")->assertNotFound();
    }

    public function test_the_saved_visibility_decides_what_the_preview_shows(): void
    {
        [$event, $admin] = $this->finished();

        $this->actor($admin)->patchJson($this->displayUrl($event), ['display_visibility' => 'rank_only'])->assertOk();

        $this->actor($admin)->getJson($this->previewUrl($event))
            ->assertJsonPath('data.visibility', 'rank_only')
            ->assertJsonPath('data.is_final', true)
            ->assertJsonMissingPath('data.rows.0.score');
    }

    public function test_the_preview_is_exactly_what_publishing_produces(): void
    {
        [$event, $admin] = $this->finished();
        $this->actor($admin)->patchJson($this->displayUrl($event), ['display_visibility' => 'rank_only', 'organization_name' => 'Faculty']);

        $preview = $this->actor($admin)->getJson($this->previewUrl($event))->json('data');
        $this->publish($event, $admin, 'rank_only');
        $public = $this->getJson("/api/v1/public/events/{$event->code}/results")->json('data');

        $this->assertEquals($public['rows'], $preview['rows']);
        $this->assertEquals($public['organization'], $preview['organization']);
        $this->assertSame($public['visibility'], $preview['visibility']);
    }

    public function test_previewing_changes_nothing(): void
    {
        [$event, , , , $admin] = $this->scoringEvent(2, 1, [100]);

        $before = [ParticipantResult::count(), ResultPublication::count(), AuditLog::count()];
        $this->actor($admin)->getJson($this->previewUrl($event))->assertOk();
        $this->actor($admin)->getJson($this->previewUrl($event))->assertOk();

        $this->assertSame($before, [ParticipantResult::count(), ResultPublication::count(), AuditLog::count()]);
    }

    public function test_display_settings_are_saved_partially_and_validated(): void
    {
        $admin = User::factory()->admin()->create();
        $event = Event::factory()->create();
        $url = $this->displayUrl($event);

        $this->actor($admin)->patchJson($url, ['organization_name' => '  Faculty of Engineering ', 'display_visibility' => 'rank_only'])
            ->assertOk()
            ->assertJsonPath('data.organization_name', 'Faculty of Engineering')
            ->assertJsonPath('data.display_visibility', 'rank_only')
            ->assertJsonPath('data.public_subtitle', null);

        $this->actor($admin)->patchJson($url, ['public_subtitle' => 'Year 4'])->assertOk()
            ->assertJsonPath('data.organization_name', 'Faculty of Engineering')
            ->assertJsonPath('data.public_subtitle', 'Year 4');

        $this->actor($admin)->patchJson($url, ['display_visibility' => 'hidden'])->assertUnprocessable()->assertJsonValidationErrors('display_visibility');
        $this->actor($admin)->patchJson($url, ['organization_name' => str_repeat('a', 151)])->assertUnprocessable()->assertJsonValidationErrors('organization_name');

        $this->actor($admin)->patchJson($url, ['organization_name' => ''])->assertOk()->assertJsonPath('data.organization_name', null);
        $this->assertDatabaseHas('audit_logs', ['action' => 'event.display_updated', 'user_id' => $admin->id]);
    }

    public function test_the_organization_logo_can_be_uploaded_replaced_and_removed(): void
    {
        $admin = User::factory()->admin()->create();
        $event = Event::factory()->create();
        $url = $this->displayUrl($event).'/logo';

        $response = $this->actor($admin)->post($url, ['logo' => $this->png()], ['Accept' => 'application/json'])->assertOk();
        $this->assertStringContainsString('/storage/organization/', $response->json('data.organization_logo_url'));

        $first = $event->fresh()->organization_logo_path;
        $this->disk()->assertExists($first);

        $this->actor($admin)->post($url, ['logo' => $this->png('second.png')], ['Accept' => 'application/json'])->assertOk();
        $second = $event->fresh()->organization_logo_path;
        $this->assertNotSame($first, $second);
        $this->disk()->assertMissing($first);
        $this->disk()->assertExists($second);

        $this->actor($admin)->deleteJson($url)->assertOk()->assertJsonPath('data.organization_logo_url', null);
        $this->assertNull($event->fresh()->organization_logo_path);
        $this->disk()->assertMissing($second);

        $this->actor($admin)->deleteJson($url)->assertOk();
        $this->assertDatabaseHas('audit_logs', ['action' => 'event.organization_logo_updated']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'event.organization_logo_removed']);
    }

    public function test_logo_uploads_are_validated(): void
    {
        $admin = User::factory()->admin()->create();
        $event = Event::factory()->create();
        $url = $this->displayUrl($event).'/logo';
        $headers = ['Accept' => 'application/json'];

        $this->actor($admin)->post($url, [], $headers)->assertUnprocessable()->assertJsonValidationErrors('logo');
        $this->actor($admin)->post($url, ['logo' => UploadedFile::fake()->create('doc.pdf', 10, 'application/pdf')], $headers)->assertUnprocessable()->assertJsonValidationErrors('logo');
        $this->actor($admin)->post($url, ['logo' => UploadedFile::fake()->create('logo.svg', 10, 'image/svg+xml')], $headers)->assertUnprocessable()->assertJsonValidationErrors('logo');
        $this->actor($admin)->post($url, ['logo' => UploadedFile::fake()->create('big.png', 3000, 'image/png')], $headers)->assertUnprocessable()->assertJsonValidationErrors('logo');

        $this->assertNull($event->fresh()->organization_logo_path);
        $this->assertSame([], $this->disk()->allFiles());
    }

    public function test_the_public_screen_gets_only_the_public_organization_fields(): void
    {
        [$event, $admin] = $this->finished();
        $this->publish($event, $admin);
        $public = "/api/v1/public/events/{$event->code}/results";

        $this->getJson($public)->assertOk()->assertJsonPath('data.organization', null);

        $this->actor($admin)->patchJson($this->displayUrl($event), ['organization_name' => 'Engineering'])->assertOk();
        $this->actor($admin)->post($this->displayUrl($event).'/logo', ['logo' => $this->png()], ['Accept' => 'application/json'])->assertOk();

        $organization = $this->getJson($public)->assertOk()->assertJsonPath('data.organization.name', 'Engineering')->json('data.organization');
        $keys = array_keys($organization);
        sort($keys);
        $this->assertSame(['logo_url', 'name'], $keys);
        $this->assertStringNotContainsString('organization_logo_path', $this->getJson($public)->getContent());
    }

    public function test_live_screens_are_told_about_display_changes_only_while_published(): void
    {
        [$published, $admin] = $this->finished();
        $this->publish($published, $admin);
        $draft = Event::factory()->create();
        EventFacade::fake([PublicResultsChanged::class]);

        $this->actor($admin)->patchJson($this->displayUrl($draft), ['organization_name' => 'A'])->assertOk();
        EventFacade::assertNotDispatched(PublicResultsChanged::class);

        $this->actor($admin)->patchJson($this->displayUrl($published), ['organization_name' => 'B'])->assertOk();
        EventFacade::assertDispatched(PublicResultsChanged::class, fn (PublicResultsChanged $e) => $e->eventCode === $published->code);
    }

    public function test_the_dashboard_counts_events_waiting_for_review_and_the_list_shows_publication(): void
    {
        [$event, $admin] = $this->finished();

        $this->actor($admin)->getJson('/api/v1/dashboard')->assertJsonPath('data.events.awaiting_review', 1);
        $this->actor($admin)->getJson('/api/v1/events?status=completed')->assertJsonPath('data.0.is_published', false);

        $this->publish($event, $admin);

        $this->actor($admin)->getJson('/api/v1/dashboard')->assertJsonPath('data.events.awaiting_review', 0);
        $this->actor($admin)->getJson('/api/v1/events?status=completed')->assertJsonPath('data.0.is_published', true);
    }

    public function test_the_checks_report_a_previous_publication_after_unpublishing(): void
    {
        [$event, $admin] = $this->finished();
        $super = User::factory()->superAdmin()->create();

        $this->actor($admin)->getJson($this->previewUrl($event))->assertJsonPath('data.checks.has_previous_publication', false);

        $this->publish($event, $admin);
        $this->actor($super)->postJson("/api/v1/events/{$event->id}/results/unpublish")->assertOk();

        $this->actor($admin)->getJson($this->previewUrl($event))
            ->assertJsonPath('data.checks.is_published', false)
            ->assertJsonPath('data.checks.has_previous_publication', true);
    }
}