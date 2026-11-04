<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

/** Tells authorised administrators to re-fetch an event's results. Carries no scores. */
class ResultsUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(public readonly int $eventId, public readonly string $calculatedAt) {}

    /** @return list<PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("events.{$this->eventId}.results")];
    }

    public function broadcastAs(): string
    {
        return 'results.updated';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return ['event_id' => $this->eventId, 'calculated_at' => $this->calculatedAt];
    }
}