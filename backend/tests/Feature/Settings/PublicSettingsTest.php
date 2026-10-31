<?php

namespace Tests\Feature\Settings;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_is_available_without_authentication_and_returns_defaults(): void
    {
        $this->getJson('/api/v1/public/settings')
            ->assertOk()
            ->assertJsonPath('data.system_name', 'Evaluation System')
            ->assertJsonPath('data.default_language', 'en');
    }

    public function test_exposes_nothing_else(): void
    {
        $this->getJson('/api/v1/public/settings')
            ->assertJsonMissingPath('data.evaluation')
            ->assertJsonMissingPath('data.timezone')
            ->assertJsonMissingPath('system')
            ->assertJsonCount(2, 'data');
    }

    public function test_follows_the_saved_default_language(): void
    {
        $super = User::factory()->superAdmin()->create();

        $this->spa()->actingAs($super, 'sanctum')->putJson('/api/v1/settings', [
            'general' => [
                'system_name' => 'ប្រព័ន្ធវាយតម្លៃ', 'default_language' => 'km', 'timezone' => 'UTC',
                'date_format' => 'Y-m-d', 'time_format' => '24h', 'pagination_size' => 15,
            ],
            'evaluation' => [
                'min_score' => 0, 'max_score' => 100, 'score_precision' => 2, 'tie_policy' => 'standard',
                'show_tie_indicator' => true, 'live_provisional_enabled' => true,
                'default_result_visibility' => 'rank_and_score',
            ],
        ])->assertOk();

        $this->getJson('/api/v1/public/settings')->assertJsonPath('data.default_language', 'km');
    }
}