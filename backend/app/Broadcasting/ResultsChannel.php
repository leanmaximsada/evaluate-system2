<?php

namespace App\Broadcasting;

use App\Enums\Permission;
use App\Models\Event;
use App\Models\User;

class ResultsChannel
{
    public function join(User $user, int $eventId): bool
    {
        return $user->hasPermission(Permission::ResultsView) && Event::whereKey($eventId)->exists();
    }
}