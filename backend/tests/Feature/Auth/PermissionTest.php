<?php

namespace Tests\Feature\Auth;

use App\Enums\Permission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Tests\TestCase;

class PermissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_has_every_permission(): void
    {
        $user = User::factory()->superAdmin()->create();

        foreach (Permission::cases() as $permission) {
            $this->assertTrue(Gate::forUser($user)->allows($permission->value), $permission->value);
        }
    }

    public function test_admin_has_limited_permissions(): void
    {
        $user = User::factory()->admin()->create();

        $this->assertTrue(Gate::forUser($user)->allows('events.manage'));
        $this->assertTrue(Gate::forUser($user)->allows('results.publish'));
        $this->assertFalse(Gate::forUser($user)->allows('users.manage'));
        $this->assertFalse(Gate::forUser($user)->allows('settings.manage'));
        $this->assertFalse(Gate::forUser($user)->allows('results.unpublish'));
        $this->assertFalse(Gate::forUser($user)->allows('audit.view'));
    }

    public function test_judge_has_no_admin_permissions(): void
    {
        $user = User::factory()->judge()->create();

        foreach (Permission::cases() as $permission) {
            $this->assertFalse(Gate::forUser($user)->allows($permission->value), $permission->value);
        }
    }

    public function test_deactivated_super_admin_is_denied_everything(): void
    {
        $user = User::factory()->superAdmin()->inactive()->create();

        $this->assertFalse(Gate::forUser($user)->allows('users.manage'));
    }

    public function test_only_super_admin_passes_the_user_policy(): void
    {
        $super = User::factory()->superAdmin()->create();
        $admin = User::factory()->admin()->create();

        $this->assertTrue(Gate::forUser($super)->allows('viewAny', User::class));
        $this->assertTrue(Gate::forUser($super)->allows('create', User::class));
        $this->assertTrue(Gate::forUser($super)->allows('update', $admin));

        $this->assertFalse(Gate::forUser($admin)->allows('viewAny', User::class));
        $this->assertFalse(Gate::forUser($admin)->allows('create', User::class));
        $this->assertFalse(Gate::forUser($admin)->allows('update', $super));
    }

    public function test_role_and_status_cannot_be_mass_assigned(): void
    {
        $user = new User([
            'name' => 'X', 'email' => 'x@example.test', 'password' => 'x',
            'role' => 'super_admin', 'is_active' => false,
        ]);

        $this->assertNull($user->role);
        $this->assertNull($user->is_active);
    }
}