<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('evaluation_forms', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('status', 20)->default('draft')->index(); // draft|active|inactive
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('evaluation_form_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('evaluation_form_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('version_number');
            $table->string('status', 20)->default('draft')->index(); // draft|published
            $table->boolean('is_weighted')->default(true);
            $table->timestampTz('published_at')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['evaluation_form_id', 'version_number']);
        });

        Schema::create('evaluation_criteria', function (Blueprint $table) {
            $table->id();
            $table->foreignId('evaluation_form_version_id')->constrained()->restrictOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('min_score', 8, 2)->default(0);
            $table->decimal('max_score', 8, 2)->default(100);
            $table->decimal('weight', 5, 2)->default(0); // percentage
            $table->unsignedInteger('display_order')->default(0);
            $table->boolean('is_required')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['evaluation_form_version_id', 'display_order'], 'criteria_version_order_idx');
        });

        DB::statement('ALTER TABLE evaluation_criteria ADD CONSTRAINT criteria_range_check CHECK (max_score > min_score)');
        DB::statement('ALTER TABLE evaluation_criteria ADD CONSTRAINT criteria_weight_check CHECK (weight >= 0 AND weight <= 100)');
    }

    public function down(): void
    {
        Schema::dropIfExists('evaluation_criteria');
        Schema::dropIfExists('evaluation_form_versions');
        Schema::dropIfExists('evaluation_forms');
    }
};