<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('evaluations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained()->restrictOnDelete();
            $table->foreignId('participant_id')->constrained()->restrictOnDelete();
            $table->foreignId('judge_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('evaluation_form_version_id')->constrained()->restrictOnDelete();
            $table->string('status', 20)->default('draft'); // draft|submitted
            $table->decimal('total_score', 8, 2)->nullable(); // normalized 0-100 weighted total
            $table->unsignedInteger('revision')->default(1);
            $table->timestampTz('submitted_at')->nullable();
            $table->timestamps();

            $table->unique(['participant_id', 'judge_id']); // duplicate-submission prevention
            $table->index(['event_id', 'status']);
        });

        Schema::create('evaluation_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('evaluation_id')->constrained()->restrictOnDelete();
            $table->foreignId('evaluation_criterion_id')->constrained('evaluation_criteria')->restrictOnDelete();
            $table->decimal('score', 8, 2);
            $table->timestamps();

            $table->unique(['evaluation_id', 'evaluation_criterion_id']);
        });

        Schema::create('evaluation_score_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('evaluation_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('revision');
            $table->foreignId('changed_by')->constrained('users')->restrictOnDelete();
            $table->text('reason')->nullable();
            $table->jsonb('previous_scores'); // frozen copy of criterion scores before the change
            $table->decimal('previous_total', 8, 2)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['evaluation_id', 'revision']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('evaluation_score_revisions');
        Schema::dropIfExists('evaluation_scores');
        Schema::dropIfExists('evaluations');
    }
};