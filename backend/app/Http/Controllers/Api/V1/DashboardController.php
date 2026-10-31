<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $gate = Gate::forUser($request->user());

        $users = $gate->allows('users.manage') ? [
            'total' => User::count(),
            'active' => User::where('is_active', true)->count(),
            'admins' => User::whereIn('role', ['super_admin', 'admin'])->count(),
            'judges' => User::where('role', 'judge')->count(),
        ] : null;

        $activity = $gate->allows('audit.view')
            ? AuditLog::with('user:id,name')->latest('id')->limit(6)->get()->map(fn (AuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'actor' => $log->user?->name,
                'created_at' => $log->created_at?->toIso8601String(),
            ])->values()
            : null;

        return response()->json(['data' => ['users' => $users, 'activity' => $activity]]);
    }
}