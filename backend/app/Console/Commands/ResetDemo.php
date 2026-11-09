<?php

namespace App\Console\Commands;

use App\Services\DemoDataService;
use Illuminate\Console\Command;
use Throwable;

class ResetDemo extends Command
{
    protected $signature = 'demo:reset {--force : Do not ask for confirmation}';

    protected $description = 'Remove the demo data and nothing else (never in production)';

    public function handle(DemoDataService $demo): int
    {
        if (app()->isProduction()) {
            $this->error('Demo data is disabled in production.');

            return self::FAILURE;
        }

        if (! $this->option('force') && ! $this->confirm('Remove all demo accounts, events and forms? Real data is not touched.')) {
            $this->line('Nothing was changed.');

            return self::FAILURE;
        }

        try {
            $removed = $demo->reset();
        } catch (Throwable $e) {
            $this->error('Could not remove the demo data: '.$e->getMessage());
            $this->line('Demo accounts or forms may be used by records that are not demo data. Nothing was removed.');

            return self::FAILURE;
        }

        $this->info("Removed {$removed['events']} events, {$removed['forms']} forms, {$removed['users']} accounts and {$removed['sponsors']} sponsor logos.");

        return self::SUCCESS;
    }
}