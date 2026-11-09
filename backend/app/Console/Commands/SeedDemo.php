<?php

namespace App\Console\Commands;

use App\Services\DemoDataService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Throwable;

class SeedDemo extends Command
{
    protected $signature = 'demo:seed
                            {--fresh : Remove existing demo data first}
                            {--password= : Password for the demo accounts (a random one is generated if omitted)}';

    protected $description = 'Create clearly marked demo data (never in production)';

    public function handle(DemoDataService $demo): int
    {
        if (app()->isProduction()) {
            $this->error('Demo data is disabled in production.');

            return self::FAILURE;
        }

        $given = (string) $this->option('password');

        if ($given !== '') {
            $validator = Validator::make(['password' => $given], ['password' => [Password::defaults()]]);
            if ($validator->fails()) {
                $this->error($validator->errors()->first('password'));

                return self::FAILURE;
            }
        }

        // Random by default, so no password is ever stored in the repository.
        $password = $given !== '' ? $given : Str::random(12).'Aa1';

        try {
            if ($this->option('fresh')) {
                $removed = $demo->reset();
                $this->line("Removed the previous demo data ({$removed['events']} events, {$removed['users']} accounts).");
            }

            $summary = $demo->seed($password);
        } catch (Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info('Demo data created.');
        $this->table(['Item', 'Count'], collect($summary)->map(fn ($count, $item) => [$item, $count])->values()->all());

        $this->newLine();
        $this->line('Accounts (all marked @demo.test):');
        $this->line('  Admins: demo.admin1@demo.test, demo.admin2@demo.test');
        $this->line('  Judges: demo.judge1@demo.test ... demo.judge5@demo.test');
        $this->line("Password: {$password}");
        if ($given === '') {
            $this->warn('This password is shown only once. Run demo:seed --fresh to get a new one.');
        }

        $this->newLine();
        $this->line('Public screen: '.rtrim((string) config('app.frontend_url'), '/').'/live/DEMO-ENG');
        $this->line('Remove everything again with: php artisan demo:reset');

        return self::SUCCESS;
    }
}