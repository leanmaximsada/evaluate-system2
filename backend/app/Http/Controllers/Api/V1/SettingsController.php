<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateSettingsRequest;
use App\Services\SettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class SettingsController extends Controller
{
    public function __construct(private readonly SettingsService $settings) {}

    public function show(): JsonResponse
    {
        Gate::authorize('settings.manage');

        return response()->json(['data' => $this->settings->all(), 'system' => $this->systemInfo()]);
    }

    public function update(UpdateSettingsRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->settings->update($request->validated(), $request->user())]);
    }

    /** Non-sensitive, read-only. Never add credentials, keys, URLs with passwords or file paths here. */
    private function systemInfo(): array
    {
        return [
            'environment' => app()->environment(),
            'debug' => (bool) config('app.debug'),
            'php_version' => PHP_VERSION,
            'laravel_version' => app()->version(),
            'database_driver' => config('database.default'),
            'queue_driver' => config('queue.default'),
            'broadcast_driver' => config('broadcasting.default'),
            'timezone' => config('app.timezone'),
        ];
    }

    /** Public and unauthenticated: expose ONLY these two non-sensitive values. */
    public function publicShow(): JsonResponse
    {
        $general = $this->settings->all()['general'];

        return response()->json(['data' => [
            'system_name' => $general['system_name'],
            'default_language' => $general['default_language'],
        ]]);
    }
}