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
            $table->string('public_subtitle', 500)->nullable()->after('category');
        });

        Schema::create('event_sponsors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->restrictOnDelete();
            $table->string('name', 150);
            $table->string('tier', 20);
            $table->string('logo_path');
            $table->unsignedInteger('display_order')->default(0);
            $table->timestamps();

            $table->index(['event_id', 'tier', 'display_order']);
        });

        DB::statement("ALTER TABLE event_sponsors ADD CONSTRAINT event_sponsors_tier_check CHECK (tier IN ('diamond','gold','silver','supporter'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('event_sponsors');

        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn('public_subtitle');
        });
    }
};