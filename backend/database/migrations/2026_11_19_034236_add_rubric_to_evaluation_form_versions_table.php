<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('evaluation_form_versions', function (Blueprint $table) {
            $table->jsonb('rubric')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('evaluation_form_versions', function (Blueprint $table) {
            $table->dropColumn('rubric');
        });
    }
};