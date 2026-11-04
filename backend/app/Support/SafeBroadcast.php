<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Throwable;

class SafeBroadcast
{
    /**
     * Sends the event only after the surrounding database transaction has committed.
     * A broadcast failure is reported and never fails the request that saved the data.
     */
    public static function afterCommit(object $event): void
    {
        DB::afterCommit(function () use ($event): void {
            try {
                event($event);
            } catch (Throwable $e) {
                report($e);
            }
        });
    }
}