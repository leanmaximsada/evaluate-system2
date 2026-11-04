<?php

namespace Tests\Feature\Broadcasting;

use App\Broadcasting\ResultsChannel;
use App\Enums\EventStatus;
use App\Events\PublicResultsChanged;
use App\Events\ResultsUpdated;
use App\Models\User;
use App\Services\EvaluationService;
use App\Services\ResultService;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event as EventFacade;
use Illuminate\Validation\ValidationException;
use Tests\Concerns\CreatesForms;
use Tests\Concerns\CreatesScoringFixtures;
use Tests\TestCase;

class BroadcastEventsTest extends TestCase
{
    use RefreshDatabase, CreatesForms, CreatesScoringFixtures;

    public function test_a_submission_announces_updated_results_on_the_admin_channel_only(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(1, 1, [100]);
        EventFacade::fake([ResultsUpdated::class, PublicResultsChanged::class]);

        app(EvaluationService::class)->submit($event, $people[0], $judges[0], $this->scoreMap($version, [80]), $judges[0]);

        EventFacade::assertDispatched(ResultsUpdated::class, fn (ResultsUpdated $e) => $e->eventId === $event->id);
        EventFacade::assertNotDispatched(PublicResultsChanged::class);
    }

    public function test_a_rejected_submission_broadcasts_nothing(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(1, 1, [100]);
        EventFacade::fake([ResultsUpdated::class, PublicResultsChanged::class]);

        try {
            app(EvaluationService::class)->submit($event, $people[0], $judges[0], $this->scoreMap($version, [101]), $judges[0]);
            $this->fail('Expected a validation error.');
        } catch (ValidationException) {
            // expected
        }

        EventFacade::assertNotDispatched(ResultsUpdated::class);
    }

    public function test_events_that_have_not_started_broadcast_nothing(): void
    {
        [$event] = $this->scoringEvent(1, 1, status: EventStatus::Draft);
        EventFacade::fake([ResultsUpdated::class]);

        app(ResultService::class)->recalculate($event);

        EventFacade::assertNotDispatched(ResultsUpdated::class);
    }

    public function test_publishing_and_unpublishing_announce_on_the_public_channel(): void
    {
        [$event, $version, $people, $judges] = $this->scoringEvent(1, 1, [100]);
        $admin = User::factory()->admin()->create();
        $super = User::factory()->superAdmin()->create();
        app(EvaluationService::class)->submit($event, $people[0], $judges[0], $this->scoreMap($version, [80]), $judges[0]);
        $event->forceFill(['status' => EventStatus::Completed])->save();

        EventFacade::fake([PublicResultsChanged::class, ResultsUpdated::class]);
        $url = "/api/v1/events/{$event->id}/results";

        $this->spa()->actingAs($admin, 'sanctum')->postJson("{$url}/publish", ['visibility' => 'rank_and_score', 'confirm' => true])->assertCreated();
        EventFacade::assertDispatched(PublicResultsChanged::class, fn (PublicResultsChanged $e) => $e->eventCode === $event->code && $e->status === 'published' && $e->revision === 1);

        $this->spa()->actingAs($super, 'sanctum')->postJson("{$url}/unpublish")->assertOk();
        EventFacade::assertDispatched(PublicResultsChanged::class, fn (PublicResultsChanged $e) => $e->status === 'unpublished');
    }

    public function test_a_refused_publication_broadcasts_nothing_public(): void
    {
        [$event, , , , ] = $this->scoringEvent(1, 1, [100]);
        $admin = User::factory()->admin()->create();
        EventFacade::fake([PublicResultsChanged::class]);

        $this->spa()->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/events/{$event->id}/results/publish", ['visibility' => 'rank_and_score', 'confirm' => true])
            ->assertUnprocessable();

        EventFacade::assertNotDispatched(PublicResultsChanged::class);
    }

    public function test_the_admin_event_uses_a_private_channel_and_a_minimal_payload(): void
    {
        $e = new ResultsUpdated(5, '2026-11-01T10:00:00+00:00');

        $channels = $e->broadcastOn();
        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PrivateChannel::class, $channels[0]);
        $this->assertSame('private-events.5.results', $channels[0]->name);
        $this->assertSame('results.updated', $e->broadcastAs());
        $this->assertSame(['event_id' => 5, 'calculated_at' => '2026-11-01T10:00:00+00:00'], $e->broadcastWith());
    }

    public function test_the_public_event_uses_a_public_channel_and_carries_no_result_data(): void
    {
        $e = new PublicResultsChanged('SF-1', 'published', 2);

        $channels = $e->broadcastOn();
        $this->assertCount(1, $channels);
        $this->assertNotInstanceOf(PrivateChannel::class, $channels[0]);
        $this->assertSame('public-results.SF-1', $channels[0]->name);
        $this->assertSame('results.changed', $e->broadcastAs());
        $this->assertSame(['status' => 'published', 'revision' => 2], $e->broadcastWith());
    }

    public function test_only_authorised_active_users_can_join_the_admin_channel(): void
    {
        [$event] = $this->scoringEvent(1, 1);
        $channel = new ResultsChannel();

        $this->assertTrue($channel->join(User::factory()->admin()->create(), $event->id));
        $this->assertTrue($channel->join(User::factory()->superAdmin()->create(), $event->id));
        $this->assertFalse($channel->join(User::factory()->judge()->create(), $event->id));
        $this->assertFalse($channel->join(User::factory()->admin()->inactive()->create(), $event->id));
        $this->assertFalse($channel->join(User::factory()->admin()->create(), 999999));
    }

    public function test_channel_authorisation_needs_a_signed_in_user(): void
    {
        $this->postJson('/api/v1/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => 'private-events.1.results'])
            ->assertUnauthorized();
    }
}