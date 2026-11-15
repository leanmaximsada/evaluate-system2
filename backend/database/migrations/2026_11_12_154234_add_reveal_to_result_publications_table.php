<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('result_publications', function (Blueprint $table) {
            $table->boolean('reveal_enabled')->default(false);
            $table->unsignedSmallInteger('reveal_top')->default(3);
            $table->unsignedSmallInteger('revealed_count')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('result_publications', function (Blueprint $table) {
            $table->dropColumn(['reveal_enabled', 'reveal_top', 'revealed_count']);
        });
    }
};