<?php

namespace Database\Seeders;

use App\Services\DemoDataService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/** Same data as `php artisan demo:seed`. Run with: php artisan db:seed --class=DemoSeeder */
class DemoSeeder extends Seeder
{
    public function run(DemoDataService $demo): void
    {
        $password = Str::random(12).'Aa1';
        $demo->seed($password);

        $this->command?->info("Demo data created. Demo account password (shown once): {$password}");
    }
}