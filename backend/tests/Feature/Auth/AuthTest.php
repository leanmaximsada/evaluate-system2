<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    private const LOGIN = '/api/v1/auth/login';

    public function test_admin_can_log_in(): void
    {
        $user = User::factory()->admin()->create(['email' => 'admin@example.test']);

        $this->spa()->postJson(self::LOGIN, ['email' => 'admin@example.test', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('data.email', 'admin@example.test')
            ->assertJsonPath('data.role', 'admin')
            ->assertJsonMissingPath('data.password')
            ->assertJsonMissingPath('data.remember_token');

        $this->assertNotNull($user->fresh()->last_login_at);
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.login', 'user_id' => $user->id]);
    }

    public function test_wrong_password_is_rejected_and_logged(): void
    {
        User::factory()->admin()->create(['email' => 'admin@example.test']);

        $this->spa()->postJson(self::LOGIN, ['email' => 'admin@example.test', 'password' => 'wrong'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.login_failed']);
    }

    public function test_inactive_admin_cannot_log_in(): void
    {
        User::factory()->admin()->inactive()->create(['email' => 'off@example.test']);

        $this->spa()->postJson(self::LOGIN, ['email' => 'off@example.test', 'password' => 'password'])
            ->assertForbidden();
    }

    public function test_judge_cannot_log_in_to_admin_system(): void
    {
        User::factory()->judge()->create(['email' => 'judge@example.test']);

        $this->spa()->postJson(self::LOGIN, ['email' => 'judge@example.test', 'password' => 'password'])
            ->assertForbidden();
    }

    public function test_login_is_throttled_after_five_attempts(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->spa()->postJson(self::LOGIN, ['email' => 'nobody@example.test', 'password' => 'x'])
                ->assertUnprocessable();
        }

        $this->spa()->postJson(self::LOGIN, ['email' => 'nobody@example.test', 'password' => 'x'])
            ->assertStatus(429);
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_me_returns_the_current_user_without_secrets(): void
    {
        $user = User::factory()->superAdmin()->create();

        $this->actingAs($user, 'sanctum')->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.role', 'super_admin')
            ->assertJsonMissingPath('data.password');
    }

    public function test_deactivated_user_is_blocked_on_existing_session(): void
    {
        $user = User::factory()->admin()->inactive()->create();

        $this->spa()->actingAs($user, 'sanctum')->getJson('/api/v1/auth/me')->assertForbidden();
    }

    public function test_logout_succeeds_and_is_audited(): void
    {
        $user = User::factory()->admin()->create();

        $this->spa()->actingAs($user, 'sanctum')->postJson('/api/v1/auth/logout')->assertNoContent();

        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.logout', 'user_id' => $user->id]);
    }

    public function test_forgot_password_sends_mail_and_does_not_reveal_unknown_emails(): void
    {
        Notification::fake();
        $user = User::factory()->admin()->create();

        $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])->assertOk();
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'nobody@example.test'])->assertOk();

        Notification::assertSentTo($user, ResetPassword::class);
        Notification::assertCount(1);
    }

    public function test_password_can_be_reset_with_a_valid_token(): void
    {
        $user = User::factory()->admin()->create();
        $token = Password::createToken($user);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'Str0ngPassword1',
            'password_confirmation' => 'Str0ngPassword1',
        ])->assertOk();

        $this->assertTrue(Hash::check('Str0ngPassword1', $user->fresh()->password));
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.password_reset']);
    }

    public function test_reset_fails_with_invalid_token_or_weak_password(): void
    {
        $user = User::factory()->admin()->create();

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => 'bad-token',
            'email' => $user->email,
            'password' => 'Str0ngPassword1',
            'password_confirmation' => 'Str0ngPassword1',
        ])->assertUnprocessable();

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => Password::createToken($user),
            'email' => $user->email,
            'password' => 'weak',
            'password_confirmation' => 'weak',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_user_can_change_password_only_with_current_password(): void
    {
        $user = User::factory()->admin()->create();

        $this->spa()->actingAs($user, 'sanctum')->putJson('/api/v1/auth/password', [
            'current_password' => 'wrong',
            'password' => 'Str0ngPassword1',
            'password_confirmation' => 'Str0ngPassword1',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');

        $this->spa()->actingAs($user, 'sanctum')->putJson('/api/v1/auth/password', [
            'current_password' => 'password',
            'password' => 'Str0ngPassword1',
            'password_confirmation' => 'Str0ngPassword1',
        ])->assertOk();

        $this->assertTrue(Hash::check('Str0ngPassword1', $user->fresh()->password));
    }

    public function test_audit_log_never_stores_passwords(): void
    {
        $user = User::factory()->admin()->create();

        app(\App\Services\AuditLogger::class)->log('test.action', $user, [
            'password' => 'secret',
            'nested' => ['token' => 'abc', 'safe' => 'ok'],
        ], $user);

        $log = \App\Models\AuditLog::where('action', 'test.action')->firstOrFail();
        $this->assertSame(['nested' => ['safe' => 'ok']], $log->summary);
    }
}