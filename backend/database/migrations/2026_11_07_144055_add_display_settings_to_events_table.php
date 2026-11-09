<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->string('organization_name', 150)->nullable()->after('public_subtitle');
            $table->string('organization_logo_path')->nullable()->after('organization_name');
            $table->string('display_visibility', 20)->default('rank_and_score')->after('organization_logo_path');
        });

        DB::statement("ALTER TABLE events ADD CONSTRAINT events_display_visibility_check CHECK (display_visibility IN ('rank_and_score','rank_only'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE events DROP CONSTRAINT IF EXISTS events_display_visibility_check');

        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn(['organization_name', 'organization_logo_path', 'display_visibility']);
        });
    }
};