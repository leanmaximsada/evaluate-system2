<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

/** Tells public screens that published results changed. They re-fetch the public API; nothing else is sent. */
class PublicResultsChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(public readonly string $eventCode, public readonly string $status, public readonly ?int $revision) {}

    /** @return list<Channel> */
    public function broadcastOn(): array
    {
        return [new Channel("public-results.{$this->eventCode}")];
    }

    public function broadcastAs(): string
    {
        return 'results.changed';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return ['status' => $this->status, 'revision' => $this->revision];
    }
}