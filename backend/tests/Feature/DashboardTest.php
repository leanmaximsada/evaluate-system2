<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Services\EvaluationService;
use Tests\Concerns\CreatesForms;
use Tests\Concerns\CreatesScoringFixtures;


class DashboardTest extends TestCase
{
    use RefreshDatabase, CreatesForms, CreatesScoringFixtures;

    public function test_requires_authentication(): void
    {
        $this->getJson('/api/v1/dashboard')->assertUnauthorized();
    }

    public function test_super_admin_sees_user_counts_and_activity(): void
    {
        $super = User::factory()->superAdmin()->create();
        User::factory()->admin()->create();
        User::factory()->judge()->inactive()->create();
        AuditLog::create(['user_id' => $super->id, 'action' => 'user.created']);

        $this->spa()->actingAs($super, 'sanctum')->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('data.users.total', 3)
            ->assertJsonPath('data.users.active', 2)
            ->assertJsonPath('data.users.admins', 2)
            ->assertJsonPath('data.users.judges', 1)
            ->assertJsonPath('data.activity.0.action', 'user.created');
    }

    public function test_admin_gets_no_user_or_audit_data(): void
    {
        $admin = User::factory()->admin()->create();

        $this->spa()->actingAs($admin, 'sanctum')->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('data.users', null)
            ->assertJsonPath('data.activity', null);
    }

        public function test_dashboard_reports_evaluation_completion_for_events_in_progress(): void
    {
        [$event, $version, $people, $judges, $admin] = $this->scoringEvent(2, 2, [100]);
        $service = app(EvaluationService::class);

        foreach ([[0, 0], [0, 1], [1, 0]] as [$p, $j]) {
            $service->submit($event, $people[$p], $judges[$j], $this->scoreMap($version, [80]), $judges[$j]);
        }

        $this->spa()->actingAs($admin, 'sanctum')->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('data.events.evaluations.expected', 4)
            ->assertJsonPath('data.events.evaluations.submitted', 3);
    }
}