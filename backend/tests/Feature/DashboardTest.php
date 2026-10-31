<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

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
}