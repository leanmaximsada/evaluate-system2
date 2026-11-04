<?php

use App\Broadcasting\ResultsChannel;
use Illuminate\Support\Facades\Broadcast;

// Admin-only live updates. Public screens use the public-results.{code} channel, which carries no scores.
Broadcast::channel('events.{eventId}.results', ResultsChannel::class);