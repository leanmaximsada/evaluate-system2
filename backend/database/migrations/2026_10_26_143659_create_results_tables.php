<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('participant_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->restrictOnDelete();
            $table->foreignId('participant_id')->constrained()->restrictOnDelete();
            $table->decimal('aggregate_score', 8, 2)->nullable(); // null until at least one submitted evaluation
            $table->unsignedInteger('rank')->nullable();
            $table->boolean('is_tied')->default(false);
            $table->unsignedInteger('judges_assigned')->default(0);
            $table->unsignedInteger('evaluations_submitted')->default(0);
            $table->boolean('is_complete')->default(false);
            $table->timestampTz('calculated_at')->nullable();
            $table->timestamps();

            $table->unique(['event_id', 'participant_id']);
            $table->index(['event_id', 'rank']);
        });

        Schema::create('result_publications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('revision');
            $table->string('status', 20)->default('published'); // published|unpublished
            $table->jsonb('snapshot'); // frozen public ranking: [{number,name,score,rank,tied}]
            $table->foreignId('published_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('published_at');
            $table->foreignId('unpublished_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampTz('unpublished_at')->nullable();
            $table->text('correction_reason')->nullable();
            $table->timestamps();

            $table->unique(['event_id', 'revision']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('result_publications');
        Schema::dropIfExists('participant_results');
    }
};