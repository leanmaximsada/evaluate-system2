<?php

namespace Tests\Feature\Users;

use App\Enums\Role;
use App\Models\User;
use App\Services\UserService;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class UserManagementTest extends TestCase
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

    /** @return array<string, string> */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'New Admin',
            'email' => 'new@example.test',
            'password' => 'Str0ngPassword1',
            'password_confirmation' => 'Str0ngPassword1',
            'role' => 'admin',
        ], $overrides);
    }

    public function test_requires_authentication(): void
    {
        $this->getJson('/api/v1/users')->assertUnauthorized();
    }

    public function test_regular_admin_cannot_manage_users(): void
    {
        $admin = User::factory()->admin()->create();

        $this->spa()->actingAs($admin, 'sanctum')->getJson('/api/v1/users')->assertForbidden();
        $this->spa()->actingAs($admin, 'sanctum')->postJson('/api/v1/users', $this->payload())->assertForbidden();
        $this->spa()->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/users/{$this->super->id}/status", ['is_active' => false])->assertForbidden();

        $this->assertTrue($this->super->fresh()->is_active);
        $this->assertDatabaseMissing('users', ['email' => 'new@example.test']);
    }

    public function test_list_is_paginated_and_hides_secrets(): void
    {
        User::factory()->count(20)->admin()->create();

        $this->asSuper()->getJson('/api/v1/users?per_page=10')
            ->assertOk()
            ->assertJsonCount(10, 'data')
            ->assertJsonPath('meta.total', 21)
            ->assertJsonMissingPath('data.0.password')
            ->assertJsonMissingPath('data.0.remember_token');
    }

    public function test_search_and_filters(): void
    {
        User::factory()->admin()->create(['name' => 'Alice Zzqx', 'email' => 'alice@example.test']);
        User::factory()->judge()->create(['name' => 'Bob Zzqx', 'email' => 'bob@example.test']);
        User::factory()->judge()->inactive()->create(['name' => 'Carl Other', 'email' => 'carl@example.test']);

        $this->asSuper()->getJson('/api/v1/users?search=zzqx')->assertJsonCount(2, 'data');
        $this->asSuper()->getJson('/api/v1/users?search=carl@example')->assertJsonCount(1, 'data');
        $this->asSuper()->getJson('/api/v1/users?role=judge')->assertJsonCount(2, 'data');
        $this->asSuper()->getJson('/api/v1/users?role=judge&status=inactive')->assertJsonCount(1, 'data');
        // LIKE wildcards are matched literally, so "%" finds nothing.
        $this->asSuper()->getJson('/api/v1/users?search=%25')->assertJsonCount(0, 'data');
    }

    public function test_invalid_sort_column_is_rejected(): void
    {
        $this->asSuper()->getJson('/api/v1/users?sort=password')
            ->assertUnprocessable()->assertJsonValidationErrors('sort');
    }

    public function test_super_admin_can_create_a_user(): void
    {
        $this->asSuper()->postJson('/api/v1/users', $this->payload(['email' => 'NEW@Example.test']))
            ->assertCreated()
            ->assertJsonPath('data.email', 'new@example.test')
            ->assertJsonPath('data.role', 'admin')
            ->assertJsonMissingPath('data.password');

        $user = User::where('email', 'new@example.test')->firstOrFail();
        $this->assertSame(Role::Admin, $user->role);
        $this->assertTrue($user->is_active);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.created', 'user_id' => $this->super->id]);
    }

    public function test_create_validation(): void
    {
        $existing = User::factory()->admin()->create();

        $this->asSuper()->postJson('/api/v1/users', $this->payload(['email' => $existing->email]))
            ->assertUnprocessable()->assertJsonValidationErrors('email');

        $this->asSuper()->postJson('/api/v1/users', $this->payload(['password' => 'weak', 'password_confirmation' => 'weak']))
            ->assertUnprocessable()->assertJsonValidationErrors('password');

        $this->asSuper()->postJson('/api/v1/users', $this->payload(['role' => 'owner']))
            ->assertUnprocessable()->assertJsonValidationErrors('role');
    }

    public function test_user_can_be_updated_and_role_change_is_audited(): void
    {
        $target = User::factory()->admin()->create();

        $this->asSuper()->putJson("/api/v1/users/{$target->id}", [
            'name' => 'Renamed', 'email' => $target->email, 'role' => 'judge',
        ])->assertOk()->assertJsonPath('data.role', 'judge')->assertJsonPath('data.name', 'Renamed');

        $this->assertDatabaseHas('audit_logs', ['action' => 'user.role_changed', 'auditable_id' => $target->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.updated', 'auditable_id' => $target->id]);
    }

    public function test_update_email_must_stay_unique(): void
    {
        $a = User::factory()->admin()->create();
        $b = User::factory()->admin()->create();

        $this->asSuper()->putJson("/api/v1/users/{$a->id}", ['name' => 'X', 'email' => $b->email, 'role' => 'admin'])
            ->assertUnprocessable()->assertJsonValidationErrors('email');

        // Keeping your own email is fine.
        $this->asSuper()->putJson("/api/v1/users/{$a->id}", ['name' => 'X', 'email' => $a->email, 'role' => 'admin'])
            ->assertOk();
    }

    public function test_cannot_change_own_role(): void
    {
        $this->asSuper()->putJson("/api/v1/users/{$this->super->id}", [
            'name' => $this->super->name, 'email' => $this->super->email, 'role' => 'admin',
        ])->assertUnprocessable()->assertJsonValidationErrors('role');

        $this->assertSame(Role::SuperAdmin, $this->super->fresh()->role);
    }

    public function test_cannot_deactivate_own_account(): void
    {
        $this->asSuper()->patchJson("/api/v1/users/{$this->super->id}/status", ['is_active' => false])
            ->assertUnprocessable()->assertJsonValidationErrors('is_active');

        $this->assertTrue($this->super->fresh()->is_active);
    }

    public function test_a_second_super_admin_can_be_demoted(): void
    {
        $other = User::factory()->superAdmin()->create();

        $this->asSuper()->putJson("/api/v1/users/{$other->id}", [
            'name' => $other->name, 'email' => $other->email, 'role' => 'admin',
        ])->assertOk();

        $this->assertSame(Role::Admin, $other->fresh()->role);
    }

    public function test_last_active_super_admin_cannot_be_deactivated(): void
    {
        // The service-level guard is a backstop (races, future roles); the API's self-checks fire first.
        $actor = User::factory()->admin()->create();

        $this->expectException(ValidationException::class);

        try {
            app(UserService::class)->setStatus($this->super, false, $actor);
        } finally {
            $this->assertTrue($this->super->fresh()->is_active);
        }
    }

    public function test_last_active_super_admin_cannot_be_demoted(): void
    {
        $actor = User::factory()->admin()->create();

        $this->expectException(ValidationException::class);

        try {
            app(UserService::class)->update($this->super, [
                'name' => $this->super->name, 'email' => $this->super->email, 'role' => 'admin',
            ], $actor);
        } finally {
            $this->assertSame(Role::SuperAdmin, $this->super->fresh()->role);
        }
    }

    public function test_deactivate_and_reactivate(): void
    {
        $target = User::factory()->admin()->create();

        $this->asSuper()->patchJson("/api/v1/users/{$target->id}/status", ['is_active' => false])
            ->assertOk()->assertJsonPath('data.is_active', false);
        $this->assertFalse($target->fresh()->is_active);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.deactivated', 'auditable_id' => $target->id]);

        $this->asSuper()->patchJson("/api/v1/users/{$target->id}/status", ['is_active' => true])
            ->assertOk()->assertJsonPath('data.is_active', true);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.activated', 'auditable_id' => $target->id]);
    }

    public function test_password_reset_link_can_be_sent(): void
    {
        Notification::fake();
        $target = User::factory()->admin()->create();

        $this->asSuper()->postJson("/api/v1/users/{$target->id}/password-reset")->assertOk();

        Notification::assertSentTo($target, ResetPassword::class);
        $this->assertDatabaseHas('audit_logs', ['action' => 'user.password_reset_requested', 'auditable_id' => $target->id]);
    }

    public function test_password_reset_is_refused_for_deactivated_accounts(): void
    {
        Notification::fake();
        $target = User::factory()->admin()->inactive()->create();

        $this->asSuper()->postJson("/api/v1/users/{$target->id}/password-reset")->assertUnprocessable();

        Notification::assertNothingSent();
    }

    public function test_unknown_user_returns_404(): void
    {
        $this->asSuper()->getJson('/api/v1/users/999999')->assertNotFound();
    }
}