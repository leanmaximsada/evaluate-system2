<?php

namespace Tests\Feature\Events;

use App\Enums\EventStatus;
use App\Events\PublicResultsChanged;
use App\Models\Event;
use App\Models\EventSponsor;
use App\Models\User;
use App\Services\EvaluationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event as EventFacade;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreatesForms;
use Tests\Concerns\CreatesScoringFixtures;
use Tests\TestCase;
use Illuminate\Filesystem\FilesystemAdapter;

/** @method \Illuminate\Filesystem\FilesystemAdapter disk(string $name) */
class SponsorTest extends TestCase
{
    use RefreshDatabase, CreatesForms, CreatesScoringFixtures;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->admin = User::factory()->admin()->create();
    }

    private function actor(): static
    {
        return $this->spa()->actingAs($this->admin, 'sanctum');
    }
        private function disk(): FilesystemAdapter
    {
        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('public');

        return $disk;
    }

        private function logo(string $name = 'logo.png'): UploadedFile
    {
        // A real 1x1 PNG, so the GD extension is not needed.
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');

        return UploadedFile::fake()->createWithContent($name, $png);
    }

    private function add(Event $event, array $overrides = [])
    {
        return $this->actor()->post(
            "/api/v1/events/{$event->id}/sponsors",
            array_merge(['name' => 'Acme', 'tier' => 'gold', 'logo' => $this->logo()], $overrides),
            ['Accept' => 'application/json'],
        );
    }

    public function test_permissions(): void
    {
        $event = Event::factory()->create();
        $judge = User::factory()->judge()->create();

        $this->getJson("/api/v1/events/{$event->id}/sponsors")->assertUnauthorized();
        $this->spa()->actingAs($judge, 'sanctum')->getJson("/api/v1/events/{$event->id}/sponsors")->assertForbidden();
        $this->actor()->getJson("/api/v1/events/{$event->id}/sponsors")->assertOk();
    }

    public function test_a_sponsor_is_created_with_a_stored_logo_and_audited(): void
    {
        $event = Event::factory()->create();

        $response = $this->add($event)->assertCreated()
            ->assertJsonPath('data.name', 'Acme')
            ->assertJsonPath('data.tier', 'gold');

        $path = EventSponsor::firstOrFail()->logo_path;
        $this->disk()->assertExists($path);
        $this->assertStringContainsString('/storage/sponsors/', $response->json('data.logo_url'));
        $this->assertDatabaseHas('audit_logs', ['action' => 'sponsor.created', 'user_id' => $this->admin->id]);
    }

    public function test_uploads_are_validated(): void
    {
        $event = Event::factory()->create();

        $this->add($event, ['logo' => null])->assertUnprocessable()->assertJsonValidationErrors('logo');
        $this->add($event, ['name' => ''])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->add($event, ['tier' => 'platinum'])->assertUnprocessable()->assertJsonValidationErrors('tier');
        $this->add($event, ['logo' => UploadedFile::fake()->create('doc.pdf', 10, 'application/pdf')])->assertUnprocessable()->assertJsonValidationErrors('logo');
        $this->add($event, ['logo' => UploadedFile::fake()->create('logo.svg', 10, 'image/svg+xml')])->assertUnprocessable()->assertJsonValidationErrors('logo');
        $this->add($event, ['logo' => UploadedFile::fake()->create('big.png', 3000, 'image/png')])->assertUnprocessable()->assertJsonValidationErrors('logo');

        $this->assertSame(0, EventSponsor::count());
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_the_list_is_ordered_by_level_then_by_chosen_order(): void
    {
        $event = Event::factory()->create();
        $this->add($event, ['name' => 'Supporter A', 'tier' => 'supporter']);
        $this->add($event, ['name' => 'Silver A', 'tier' => 'silver']);
        $this->add($event, ['name' => 'Diamond A', 'tier' => 'diamond']);
        $this->add($event, ['name' => 'Silver B', 'tier' => 'silver']);

        $names = collect($this->actor()->getJson("/api/v1/events/{$event->id}/sponsors")->json('data'))->pluck('name')->all();

        $this->assertSame(['Diamond A', 'Silver A', 'Silver B', 'Supporter A'], $names);
    }

    public function test_update_keeps_the_logo_unless_a_new_one_is_sent_and_removes_the_old_file(): void
    {
        $event = Event::factory()->create();
        $this->add($event)->assertCreated();
        $sponsor = EventSponsor::firstOrFail();
        $firstPath = $sponsor->logo_path;
        $url = "/api/v1/events/{$event->id}/sponsors/{$sponsor->id}";

        $this->actor()->post($url, ['name' => 'Acme Corp', 'tier' => 'diamond'], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.name', 'Acme Corp')->assertJsonPath('data.tier', 'diamond');
        $this->assertSame($firstPath, $sponsor->fresh()->logo_path);
        $this->disk()->assertExists($firstPath);

        $this->actor()->post($url, ['name' => 'Acme Corp', 'tier' => 'diamond', 'logo' => $this->logo('new.png')], ['Accept' => 'application/json'])->assertOk();
        $secondPath = $sponsor->fresh()->logo_path;
        $this->assertNotSame($firstPath, $secondPath);
        $this->disk()->assertMissing($firstPath);
        $this->disk()->assertExists($secondPath);
    }

    public function test_deleting_a_sponsor_removes_its_file(): void
    {
        $event = Event::factory()->create();
        $this->add($event)->assertCreated();
        $sponsor = EventSponsor::firstOrFail();
        $path = $sponsor->logo_path;

        $this->actor()->deleteJson("/api/v1/events/{$event->id}/sponsors/{$sponsor->id}")->assertNoContent();

        $this->assertSame(0, EventSponsor::count());
        $this->disk()->assertMissing($path);
        $this->assertDatabaseHas('audit_logs', ['action' => 'sponsor.deleted']);
    }

    public function test_sponsors_can_be_reordered(): void
    {
        $event = Event::factory()->create();
        $a = $this->add($event, ['name' => 'A', 'tier' => 'gold'])->json('data.id');
        $b = $this->add($event, ['name' => 'B', 'tier' => 'gold'])->json('data.id');
        $url = "/api/v1/events/{$event->id}/sponsors/order";

        $this->actor()->putJson($url, ['order' => [$b, $a]])->assertOk()->assertJsonPath('data.0.name', 'B');
        $this->actor()->putJson($url, ['order' => [$a]])->assertUnprocessable()->assertJsonValidationErrors('order');
    }

    public function test_a_sponsor_cannot_be_reached_through_another_event(): void
    {
        $event = Event::factory()->create();
        $other = Event::factory()->create();
        $this->add($event)->assertCreated();
        $sponsor = EventSponsor::firstOrFail();

        $this->actor()->deleteJson("/api/v1/events/{$other->id}/sponsors/{$sponsor->id}")->assertNotFound();
        $this->actor()->post("/api/v1/events/{$other->id}/sponsors/{$sponsor->id}", ['name' => 'X', 'tier' => 'gold'], ['Accept' => 'application/json'])->assertNotFound();

        $this->assertModelExists($sponsor);
        $this->disk()->assertExists($sponsor->logo_path);
    }

    public function test_an_event_has_a_sponsor_limit(): void
    {
        $event = Event::factory()->create();
        for ($i = 1; $i <= 40; $i++) {
            $row = new EventSponsor();
            $row->event_id = $event->id;
            $row->name = "S{$i}";
            $row->tier = \App\Enums\SponsorTier::Supporter;
            $row->logo_path = "sponsors/{$event->id}/x{$i}.png";
            $row->display_order = $i;
            $row->save();
        }

        $this->add($event)->assertUnprocessable()->assertJsonValidationErrors('sponsor');
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_the_subtitle_can_be_saved_cleared_and_is_limited(): void
    {
        $event = Event::factory()->create();
        $url = "/api/v1/events/{$event->id}/display";

        $this->actor()->patchJson($url, ['public_subtitle' => "Department: IT\r\nYear: 4 "])
            ->assertOk()->assertJsonPath('data.public_subtitle', "Department: IT\nYear: 4");
        $this->actor()->getJson("/api/v1/events/{$event->id}")->assertJsonPath('data.public_subtitle', "Department: IT\nYear: 4");

        $this->actor()->patchJson($url, ['public_subtitle' => str_repeat('a', 501)])->assertUnprocessable()->assertJsonValidationErrors('public_subtitle');

        $this->actor()->patchJson($url, ['public_subtitle' => ''])->assertOk()->assertJsonPath('data.public_subtitle', null);
        $this->assertDatabaseHas('audit_logs', ['action' => 'event.display_updated']);
    }

    /** @return array{0: Event, 1: User} A completed, published event. */
    private function publishedEvent(): array
    {
        [$event, $version, $people, $judges, $admin] = $this->scoringEvent(2, 1, [100]);
        foreach ([90, 80] as $i => $score) {
            app(EvaluationService::class)->submit($event, $people[$i], $judges[0], $this->scoreMap($version, [$score]), $judges[0]);
        }
        $event->forceFill(['status' => EventStatus::Completed])->save();
        $this->spa()->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/events/{$event->id}/results/publish", ['visibility' => 'rank_and_score', 'confirm' => true])->assertCreated();

        return [$event, $admin];
    }

    public function test_the_public_screen_gets_the_subtitle_and_only_public_sponsor_fields(): void
    {
        [$event, $admin] = $this->publishedEvent();
        $this->spa()->actingAs($admin, 'sanctum');
        $this->actingAs($admin, 'sanctum')->spa()->post("/api/v1/events/{$event->id}/sponsors", ['name' => 'Acme', 'tier' => 'diamond', 'logo' => $this->logo()], ['Accept' => 'application/json'])->assertCreated();
        $this->actingAs($admin, 'sanctum')->spa()->patchJson("/api/v1/events/{$event->id}/display", ['public_subtitle' => 'Year: 4'])->assertOk();

        $response = $this->getJson("/api/v1/public/events/{$event->code}/results")->assertOk()
            ->assertJsonPath('data.event.subtitle', 'Year: 4')
            ->assertJsonCount(1, 'data.sponsors');

        $sponsor = $response->json('data.sponsors.0');
        $keys = array_keys($sponsor);
        sort($keys);
        $this->assertSame(['logo_url', 'name', 'tier'], $keys);
        $this->assertSame('Acme', $sponsor['name']);
        $this->assertStringNotContainsString('logo_path', $response->getContent());
    }

    public function test_sponsors_stay_hidden_while_results_are_unpublished(): void
    {
        $event = Event::factory()->withStatus(EventStatus::Completed)->create();
        $this->add($event)->assertCreated();

        $this->getJson("/api/v1/public/events/{$event->code}/results")->assertNotFound();
    }

    public function test_live_screens_are_told_when_sponsors_change_only_while_published(): void
    {
        [$published] = $this->publishedEvent();
        $draft = Event::factory()->create();
        EventFacade::fake([PublicResultsChanged::class]);

        $this->add($draft)->assertCreated();
        EventFacade::assertNotDispatched(PublicResultsChanged::class);

        $this->add($published)->assertCreated();
        EventFacade::assertDispatched(PublicResultsChanged::class, fn (PublicResultsChanged $e) => $e->eventCode === $published->code);
    }
}