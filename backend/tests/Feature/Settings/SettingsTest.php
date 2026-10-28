<?php

namespace Tests\Feature\Settings;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettingsTest extends TestCase
{
    use RefreshDatabase;

    private User $super;

    protected function setUp(): void
    {
        parent::setUp();
        $this->super = User::factory()->superAdmin()->create();
    }

    private function asSuper(): static
    {
        return $this->spa()->actingAs($this->super, 'sanctum');
    }

    /** @return array<string, array<string, mixed>> */
    private function payload(array $general = [], array $evaluation = []): array
    {
        return [
            'general' => array_merge([
                'system_name' => 'Science Fair',
                'default_language' => 'en',
                'timezone' => 'Asia/Phnom_Penh',
                'date_format' => 'd/m/Y',
                'time_format' => '24h',
                'pagination_size' => 25,
            ], $general),
            'evaluation' => array_merge([
                'min_score' => 0,
                'max_score' => 10,
                'score_precision' => 1,
                'tie_policy' => 'dense',
                'show_tie_indicator' => true,
                'live_provisional_enabled' => false,
                'default_result_visibility' => 'rank_only',
            ], $evaluation),
        ];
    }

    public function test_requires_authentication(): void
    {
        $this->getJson('/api/v1/settings')->assertUnauthorized();
        $this->putJson('/api/v1/settings', $this->payload())->assertUnauthorized();
    }

    public function test_regular_admin_is_forbidden(): void
    {
        $admin = User::factory()->admin()->create();

        $this->spa()->actingAs($admin, 'sanctum')->getJson('/api/v1/settings')->assertForbidden();
        $this->spa()->actingAs($admin, 'sanctum')->putJson('/api/v1/settings', $this->payload())->assertForbidden();
        $this->assertDatabaseCount('system_settings', 0);
    }

    public function test_defaults_are_returned_when_nothing_is_stored(): void
    {
        $this->asSuper()->getJson('/api/v1/settings')
            ->assertOk()
            ->assertJsonPath('data.general.system_name', 'Evaluation System')
            ->assertJsonPath('data.evaluation.max_score', 100)
            ->assertJsonPath('data.evaluation.tie_policy', 'standard')
            ->assertJsonPath('data.evaluation.live_provisional_enabled', true)
            ->assertJsonStructure(['system' => ['environment', 'debug', 'php_version', 'laravel_version', 'database_driver']]);
    }

    public function test_update_persists_and_is_audited_with_old_and_new_values(): void
    {
        $this->asSuper()->putJson('/api/v1/settings', $this->payload())
            ->assertOk()
            ->assertJsonPath('data.general.system_name', 'Science Fair')
            ->assertJsonPath('data.evaluation.live_provisional_enabled', false);

        $this->asSuper()->getJson('/api/v1/settings')
            ->assertJsonPath('data.general.pagination_size', 25)
            ->assertJsonPath('data.evaluation.max_score', 10)
            ->assertJsonPath('data.evaluation.default_result_visibility', 'rank_only');

        $log = \App\Models\AuditLog::where('action', 'settings.updated')->firstOrFail();
        $this->assertSame($this->super->id, $log->user_id);
      $this->assertEquals(
    ['from' => 'Evaluation System', 'to' => 'Science Fair'],
    $log->summary['changes']['general.system_name'],
);
$this->assertEquals(['from' => true, 'to' => false], $log->summary['changes']['evaluation.live_provisional_enabled']);
    }

    public function test_saving_unchanged_values_creates_no_audit_entry(): void
    {
        $this->asSuper()->putJson('/api/v1/settings', $this->payload())->assertOk();
        $this->asSuper()->putJson('/api/v1/settings', $this->payload())->assertOk();

        $this->assertSame(1, \App\Models\AuditLog::where('action', 'settings.updated')->count());
    }

    public function test_validation_rules(): void
    {
        $this->asSuper()->putJson('/api/v1/settings', $this->payload(evaluation: ['min_score' => 10, 'max_score' => 10]))
            ->assertUnprocessable()->assertJsonValidationErrors('evaluation.max_score');

        $this->asSuper()->putJson('/api/v1/settings', $this->payload(general: ['timezone' => 'Mars/Olympus']))
            ->assertUnprocessable()->assertJsonValidationErrors('general.timezone');

        $this->asSuper()->putJson('/api/v1/settings', $this->payload(general: ['pagination_size' => 1000]))
            ->assertUnprocessable()->assertJsonValidationErrors('general.pagination_size');

        $this->asSuper()->putJson('/api/v1/settings', $this->payload(evaluation: ['tie_policy' => 'random']))
            ->assertUnprocessable()->assertJsonValidationErrors('evaluation.tie_policy');

        $this->asSuper()->putJson('/api/v1/settings', $this->payload(general: ['system_name' => '']))
            ->assertUnprocessable()->assertJsonValidationErrors('general.system_name');

        $this->assertDatabaseCount('system_settings', 0);
    }

    public function test_incomplete_payload_is_rejected(): void
    {
        $this->asSuper()->putJson('/api/v1/settings', ['general' => $this->payload()['general']])
            ->assertUnprocessable()->assertJsonValidationErrors('evaluation');
    }

    public function test_unknown_keys_are_ignored(): void
    {
        $payload = $this->payload();
        $payload['general']['db_password'] = 'hunter2';
        $payload['security'] = ['anything' => 'x'];

        $this->asSuper()->putJson('/api/v1/settings', $payload)->assertOk();

        $this->assertDatabaseMissing('system_settings', ['key' => 'general.db_password']);
        $this->assertDatabaseMissing('system_settings', ['key' => 'security.anything']);
    }
}