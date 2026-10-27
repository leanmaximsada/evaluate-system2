<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->validated();

        if (! Auth::guard('web')->attempt($credentials)) {
            $this->audit->log('auth.login_failed', null, ['email' => $credentials['email']]);

            throw ValidationException::withMessages(['email' => [__('auth.failed')]]);
        }

        /** @var User $user */
        $user = Auth::guard('web')->user();

        if (! $user->is_active || ! $user->isAdmin()) {
            $reason = ! $user->is_active ? 'inactive' : 'not_admin';

            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            $this->audit->log('auth.login_denied', $user, ['reason' => $reason], $user);

            return response()->json([
                'message' => $reason === 'inactive'
                    ? 'Your account has been deactivated.'
                    : 'This account does not have access to the administration system.',
            ], 403);
        }

        $request->session()->regenerate();

        $user->forceFill(['last_login_at' => now()])->save();
        $this->audit->log('auth.login', $user, [], $user);

        return UserResource::make($user)->response();
    }

    public function logout(Request $request): Response
    {
        $this->audit->log('auth.logout', $request->user());

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    public function me(Request $request): UserResource
    {
        return UserResource::make($request->user());
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->forceFill(['password' => $request->validated('password')])->save();

        $this->audit->log('auth.password_changed', $user);

        return response()->json(['message' => 'Password updated.']);
    }
}