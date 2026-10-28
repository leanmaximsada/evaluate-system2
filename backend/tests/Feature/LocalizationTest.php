<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LocalizationTest extends TestCase
{
    use RefreshDatabase;

    private const LOGIN = '/api/v1/auth/login';

    public function test_validation_errors_follow_accept_language(): void
    {
        $en = $this->spa()->postJson(self::LOGIN, [])->json('errors.email.0');
        $km = $this->spa()->withHeader('Accept-Language', 'km')->postJson(self::LOGIN, [])->json('errors.email.0');

        $this->assertNotSame($en, $km);
        $this->assertStringContainsString('អ៊ីមែល', $km);
    }

    public function test_custom_messages_are_translated(): void
    {
        User::factory()->admin()->inactive()->create(['email' => 'off@example.test']);
        $body = ['email' => 'off@example.test', 'password' => 'password'];

        $this->spa()->withHeader('Accept-Language', 'km')->postJson(self::LOGIN, $body)
            ->assertForbidden()->assertJsonPath('message', 'គណនីរបស់អ្នកត្រូវបានបិទដំណើរការ។');
    }

    public function test_unsupported_language_falls_back_to_english(): void
    {
        User::factory()->admin()->inactive()->create(['email' => 'off@example.test']);
        $body = ['email' => 'off@example.test', 'password' => 'password'];

        $this->spa()->withHeader('Accept-Language', 'fr')->postJson(self::LOGIN, $body)
            ->assertForbidden()->assertJsonPath('message', 'Your account has been deactivated.');
    }

    public function test_response_reports_its_language(): void
    {
        $this->spa()->withHeader('Accept-Language', 'km')->postJson(self::LOGIN, [])
            ->assertHeader('Content-Language', 'km');
    }
}