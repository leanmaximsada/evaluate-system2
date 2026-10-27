<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 50)->unique();
            $table->text('description')->nullable();
            $table->string('venue')->nullable();
            $table->timestampTz('starts_at');
            $table->timestampTz('ends_at');
            $table->string('timezone', 64)->default('UTC');
            $table->string('category', 100)->nullable();
            $table->string('status', 20)->default('draft')->index(); // draft|upcoming|in_progress|completed|cancelled
            $table->foreignId('evaluation_form_version_id')->nullable()->constrained()->restrictOnDelete();
            $table->jsonb('scoring_policy')->nullable(); // snapshot frozen when event starts
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'starts_at']);
        });

        DB::statement('ALTER TABLE events ADD CONSTRAINT events_dates_check CHECK (ends_at >= starts_at)');

        Schema::create('participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->restrictOnDelete();
            $table->string('name');
            $table->string('number', 20);
            $table->string('team_name')->nullable();
            $table->text('description')->nullable();
            $table->unsignedInteger('presentation_order')->nullable();
            $table->string('status', 20)->default('registered'); // registered|withdrawn|disqualified
            $table->timestamps();

            $table->unique(['event_id', 'number']);
        });

        // Deferrable so a reorder can swap positions inside one transaction.
        DB::statement('ALTER TABLE participants ADD CONSTRAINT participants_order_unique UNIQUE (event_id, presentation_order) DEFERRABLE INITIALLY DEFERRED');

        Schema::create('event_judges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('assigned_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['event_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_judges');
        Schema::dropIfExists('participants');
        Schema::dropIfExists('events');
    }
};