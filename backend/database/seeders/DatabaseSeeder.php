<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Nothing is created automatically, so this is safe to run anywhere.
     *
     *   First Super Admin:  php artisan app:create-super-admin
     *   Demo data:          php artisan demo:seed
     */
    public function run(): void
    {
        $this->command?->info('No data created. Create the first Super Admin with: php artisan app:create-super-admin');
    }
}