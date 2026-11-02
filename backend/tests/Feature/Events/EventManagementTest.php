<?php

namespace Tests\Feature\Events;

use App\Enums\EventStatus;
use App\Models\Event;
use App\Models\Participant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
use Tests\Concerns\CreatesForms;

class EventManagementTest extends TestCase
{
    use RefreshDatabase, CreatesForms;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
    }

    private function actor(?User $user = null): static
    {
        return $this->spa()->actingAs($user ?? $this->admin, 'sanctum');
    }

    /** @return array<string, string> */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Science Fair',
            'code' => 'sf-2026',
            'description' => 'Annual fair',
            'venue' => 'Main Hall',
            'category' => 'Competition',
            'timezone' => 'Asia/Phnom_Penh',
            'starts_at' => '2026-12-01T09:00',
            'ends_at' => '2026-12-01T17:00',
        ], $overrides);
    }

    public function test_requires_authentication_and_the_events_permission(): void
    {
        $this->getJson('/api/v1/events')->assertUnauthorized();

        $judge = User::factory()->judge()->create();
        $this->actor($judge)->getJson('/api/v1/events')->assertForbidden();
        $this->actor($judge)->postJson('/api/v1/events', $this->payload())->assertForbidden();
    }

    public function test_admin_can_create_an_event(): void
    {
        $this->actor()->postJson('/api/v1/events', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.code', 'SF-2026')
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.starts_at', '2026-12-01T02:00:00+00:00')
            ->assertJsonPath('data.starts_at_local', '2026-12-01T09:00')
            ->assertJsonPath('data.created_by', $this->admin->name);

        $this->assertDatabaseHas('audit_logs', ['action' => 'event.created', 'user_id' => $this->admin->id]);
    }

    public function test_create_validation(): void
    {
        Event::factory()->create(['code' => 'SF-2026']);

        $this->actor()->postJson('/api/v1/events', $this->payload())
            ->assertUnprocessable()->assertJsonValidationErrors('code');

        $this->actor()->postJson('/api/v1/events', $this->payload(['code' => 'bad code!']))
            ->assertUnprocessable()->assertJsonValidationErrors('code');

        $this->actor()->postJson('/api/v1/events', $this->payload(['code' => 'NEW-1', 'ends_at' => '2026-12-01T08:00']))
            ->assertUnprocessable()->assertJsonValidationErrors('ends_at');

        $this->actor()->postJson('/api/v1/events', $this->payload(['code' => 'NEW-2', 'timezone' => 'Mars/Olympus']))
            ->assertUnprocessable()->assertJsonValidationErrors('timezone');
    }

    public function test_list_search_filter_and_counts(): void
    {
        $a = Event::factory()->create(['name' => 'Zzqx Alpha', 'code' => 'ZA-1']);
        Event::factory()->withStatus(EventStatus::Upcoming)->create(['name' => 'Beta', 'code' => 'ZB-1']);
        Participant::factory()->count(2)->create(['event_id' => $a->id]);

        $this->actor()->getJson('/api/v1/events?search=zzqx')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.participants_count', 2);

        $this->actor()->getJson('/api/v1/events?status=upcoming')->assertJsonCount(1, 'data');
        $this->actor()->getJson('/api/v1/events?search=%25')->assertJsonCount(0, 'data');
        $this->actor()->getJson('/api/v1/events?sort=created_by')->assertUnprocessable();
    }

    public function test_draft_event_can_be_fully_edited(): void
    {
        $event = Event::factory()->create();

        $this->actor()->putJson("/api/v1/events/{$event->id}", $this->payload(['code' => 'NEW-9', 'name' => 'Renamed']))
            ->assertOk()->assertJsonPath('data.code', 'NEW-9')->assertJsonPath('data.name', 'Renamed');

        $this->assertDatabaseHas('audit_logs', ['action' => 'event.updated', 'auditable_id' => $event->id]);
    }

    public function test_started_event_locks_code_dates_and_timezone(): void
    {
        $event = Event::factory()->withStatus(EventStatus::InProgress)->create([
            'code' => 'LIVE-1', 'timezone' => 'Asia/Phnom_Penh',
            'starts_at' => '2026-12-01 02:00:00', 'ends_at' => '2026-12-01 10:00:00',
        ]);

        $this->actor()->putJson("/api/v1/events/{$event->id}", $this->payload(['code' => 'CHANGED']))
            ->assertUnprocessable()->assertJsonValidationErrors('code');

        $this->actor()->putJson("/api/v1/events/{$event->id}", $this->payload(['code' => 'LIVE-1', 'name' => 'New name', 'ends_at' => '2026-12-01T18:00']))
            ->assertUnprocessable()->assertJsonValidationErrors('ends_at');

        $this->actor()->putJson("/api/v1/events/{$event->id}", $this->payload(['code' => 'LIVE-1', 'name' => 'New name']))
            ->assertOk()->assertJsonPath('data.name', 'New name');
    }

    public function test_completed_event_is_read_only(): void
    {
        $event = Event::factory()->withStatus(EventStatus::Completed)->create();

        $this->actor()->putJson("/api/v1/events/{$event->id}", $this->payload(['code' => $event->code]))
            ->assertUnprocessable()->assertJsonValidationErrors('event');
    }

    public function test_status_transitions_follow_the_rules(): void
    {
        $event = Event::factory()->create();

        $this->actor()->patchJson("/api/v1/events/{$event->id}/status", ['status' => 'completed'])
            ->assertUnprocessable()->assertJsonValidationErrors('status');

        $this->actor()->patchJson("/api/v1/events/{$event->id}/status", ['status' => 'upcoming'])
            ->assertOk()->assertJsonPath('data.status', 'upcoming');

        $this->actor()->patchJson("/api/v1/events/{$event->id}/status", ['status' => 'bogus'])
            ->assertUnprocessable();

        $this->assertDatabaseHas('audit_logs', ['action' => 'event.status_changed', 'auditable_id' => $event->id]);

        $final = Event::factory()->withStatus(EventStatus::Cancelled)->create();
        $this->actor()->patchJson("/api/v1/events/{$final->id}/status", ['status' => 'draft'])->assertUnprocessable();
    }

    public function test_starting_requires_a_participant_a_judge_and_a_form(): void
    {
        $event = Event::factory()->withStatus(EventStatus::Upcoming)->create();
        $url = "/api/v1/events/{$event->id}/status";

        $this->actor()->patchJson($url, ['status' => 'in_progress'])->assertUnprocessable();

        Participant::factory()->create(['event_id' => $event->id, 'presentation_order' => 1]);
        $this->actor()->patchJson($url, ['status' => 'in_progress'])->assertUnprocessable();

        $event->judges()->attach(User::factory()->judge()->create()->id, ['assigned_by' => $this->admin->id]);
        $this->actor()->patchJson($url, ['status' => 'in_progress'])->assertUnprocessable();

        $event->evaluation_form_version_id = $this->publishedVersion($this->admin)->id;
        $event->save();

        $this->actor()->patchJson($url, ['status' => 'in_progress'])
            ->assertOk()->assertJsonPath('data.status', 'in_progress');
    }

    public function test_starting_freezes_the_scoring_policy(): void
    {
        $event = Event::factory()->withStatus(EventStatus::Upcoming)->create();
        Participant::factory()->create(['event_id' => $event->id, 'presentation_order' => 1]);
        $event->judges()->attach(User::factory()->judge()->create()->id, ['assigned_by' => $this->admin->id]);
        $version = $this->publishedVersion($this->admin);
        $event->evaluation_form_version_id = $version->id;
        $event->save();

        $this->actor()->patchJson("/api/v1/events/{$event->id}/status", ['status' => 'in_progress'])->assertOk();

        $policy = $event->fresh()->scoring_policy;
        $this->assertSame('standard', $policy['tie_policy']);
        $this->assertSame('mean', $policy['aggregation']);
        $this->assertSame('exclude', $policy['missing_scores']);
        $this->assertSame($version->id, $policy['form_version_id']);
        $this->assertArrayHasKey('frozen_at', $policy);
    }

    public function test_translated_error_follows_accept_language(): void
    {
        $event = Event::factory()->create();

        $this->actor()->withHeader('Accept-Language', 'km')
            ->patchJson("/api/v1/events/{$event->id}/status", ['status' => 'completed'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.status.0', 'ការផ្លាស់ប្ដូរស្ថានភាពនេះមិនត្រូវបានអនុញ្ញាតទេ។');
    }

    public function test_participants_get_automatic_order_and_unique_numbers_per_event(): void
    {
        $event = Event::factory()->create();
        $other = Event::factory()->create();
        $url = "/api/v1/events/{$event->id}/participants";

        $this->actor()->postJson($url, ['name' => 'Alice', 'number' => 1])
            ->assertCreated()->assertJsonPath('data.presentation_order', 1)->assertJsonPath('data.number', '1');
        $this->actor()->postJson($url, ['name' => 'Bob', 'number' => '2'])
            ->assertCreated()->assertJsonPath('data.presentation_order', 2);

        $this->actor()->postJson($url, ['name' => 'Dup', 'number' => '1'])
            ->assertUnprocessable()->assertJsonValidationErrors('number');

        $this->actor()->postJson("/api/v1/events/{$other->id}/participants", ['name' => 'Carol', 'number' => '1'])
            ->assertCreated();

        $this->actor()->getJson($url)->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.name', 'Alice');
    }

    public function test_participants_can_be_reordered(): void
    {
        $event = Event::factory()->create();
        [$a, $b, $c] = Participant::factory()->count(3)->sequence(
            ['number' => '1', 'presentation_order' => 1],
            ['number' => '2', 'presentation_order' => 2],
            ['number' => '3', 'presentation_order' => 3],
        )->create(['event_id' => $event->id]);

        $this->actor()->putJson("/api/v1/events/{$event->id}/participants/order", ['order' => [$c->id, $a->id, $b->id]])
            ->assertOk()
            ->assertJsonPath('data.0.id', $c->id)
            ->assertJsonPath('data.2.id', $b->id);

        $this->actor()->putJson("/api/v1/events/{$event->id}/participants/order", ['order' => [$c->id, $a->id]])
            ->assertUnprocessable()->assertJsonValidationErrors('order');
    }

    public function test_deleting_a_participant_closes_the_gap(): void
    {
        $event = Event::factory()->create();
        [$a, $b, $c] = Participant::factory()->count(3)->sequence(
            ['number' => '1', 'presentation_order' => 1],
            ['number' => '2', 'presentation_order' => 2],
            ['number' => '3', 'presentation_order' => 3],
        )->create(['event_id' => $event->id]);

        $this->actor()->deleteJson("/api/v1/events/{$event->id}/participants/{$b->id}")->assertNoContent();

        $this->assertSame(2, $c->fresh()->presentation_order);
        $this->assertSame(1, $a->fresh()->presentation_order);
    }

    public function test_participant_cannot_be_reached_through_another_event(): void
    {
        $event = Event::factory()->create();
        $other = Event::factory()->create();
        $participant = Participant::factory()->create(['event_id' => $other->id, 'presentation_order' => 1]);

        $this->actor()->deleteJson("/api/v1/events/{$event->id}/participants/{$participant->id}")->assertNotFound();
        $this->assertModelExists($participant);
    }

    public function test_participants_cannot_be_added_or_removed_after_start_but_can_be_withdrawn(): void
    {
        $event = Event::factory()->withStatus(EventStatus::InProgress)->create();
        $p = Participant::factory()->create(['event_id' => $event->id, 'presentation_order' => 1, 'number' => '1']);

        $this->actor()->postJson("/api/v1/events/{$event->id}/participants", ['name' => 'Late', 'number' => '9'])
            ->assertUnprocessable();
        $this->actor()->deleteJson("/api/v1/events/{$event->id}/participants/{$p->id}")->assertUnprocessable();

        $this->actor()->putJson("/api/v1/events/{$event->id}/participants/{$p->id}", ['name' => $p->name, 'number' => '1', 'status' => 'withdrawn'])
            ->assertOk()->assertJsonPath('data.status', 'withdrawn');
    }

    public function test_only_active_judges_can_be_assigned_once(): void
    {
        $event = Event::factory()->create();
        $url = "/api/v1/events/{$event->id}/judges";
        $judge = User::factory()->judge()->create();

        $this->actor()->postJson($url, ['user_id' => $judge->id])->assertCreated()->assertJsonPath('data.email', $judge->email);
        $this->actor()->postJson($url, ['user_id' => $judge->id])->assertUnprocessable()->assertJsonValidationErrors('user_id');

        $this->actor()->postJson($url, ['user_id' => User::factory()->admin()->create()->id])->assertUnprocessable();
        $this->actor()->postJson($url, ['user_id' => User::factory()->judge()->inactive()->create()->id])->assertUnprocessable();

        $this->actor()->getJson($url)->assertOk()->assertJsonCount(1, 'data');
        $this->assertDatabaseHas('audit_logs', ['action' => 'judge.assigned', 'auditable_id' => $event->id]);
    }

    public function test_judge_can_be_unassigned_unless_they_have_evaluations(): void
    {
        $event = Event::factory()->create();
        $judge = User::factory()->judge()->create();
        $scored = User::factory()->judge()->create();
        $event->judges()->attach([$judge->id => ['assigned_by' => $this->admin->id], $scored->id => ['assigned_by' => $this->admin->id]]);

        $participant = Participant::factory()->create(['event_id' => $event->id, 'presentation_order' => 1]);
        $now = now();
        $form = DB::table('evaluation_forms')->insertGetId(['name' => 'F', 'status' => 'draft', 'created_by' => $this->admin->id, 'created_at' => $now, 'updated_at' => $now]);
        $version = DB::table('evaluation_form_versions')->insertGetId(['evaluation_form_id' => $form, 'version_number' => 1, 'status' => 'published', 'is_weighted' => true, 'created_by' => $this->admin->id, 'created_at' => $now, 'updated_at' => $now]);
        DB::table('evaluations')->insert(['event_id' => $event->id, 'participant_id' => $participant->id, 'judge_id' => $scored->id, 'evaluation_form_version_id' => $version, 'status' => 'draft', 'revision' => 1, 'created_at' => $now, 'updated_at' => $now]);

        $this->actor()->deleteJson("/api/v1/events/{$event->id}/judges/{$scored->id}")->assertUnprocessable();
        $this->actor()->deleteJson("/api/v1/events/{$event->id}/judges/{$judge->id}")->assertNoContent();

        $this->assertDatabaseMissing('event_judges', ['event_id' => $event->id, 'user_id' => $judge->id]);
        $this->assertDatabaseHas('event_judges', ['event_id' => $event->id, 'user_id' => $scored->id]);
    }

    public function test_candidates_exclude_assigned_inactive_and_non_judges(): void
    {
        $event = Event::factory()->create();
        $free = User::factory()->judge()->create(['name' => 'Free Judge']);
        $taken = User::factory()->judge()->create();
        User::factory()->judge()->inactive()->create();
        User::factory()->admin()->create();
        $event->judges()->attach($taken->id, ['assigned_by' => $this->admin->id]);

        $this->actor()->getJson("/api/v1/events/{$event->id}/judge-candidates")
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $free->id);
    }

    public function test_judges_cannot_be_changed_on_a_closed_event(): void
    {
        $event = Event::factory()->withStatus(EventStatus::Completed)->create();

        $this->actor()->postJson("/api/v1/events/{$event->id}/judges", ['user_id' => User::factory()->judge()->create()->id])
            ->assertUnprocessable()->assertJsonValidationErrors('event');
    }
}