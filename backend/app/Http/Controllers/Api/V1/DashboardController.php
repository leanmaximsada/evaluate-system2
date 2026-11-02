<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\EventStatus;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Event;
use App\Models\Participant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

        $events = null;
        if ($gate->allows('events.manage')) {
            $counts = Event::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

            $events = [
                'total' => (int) $counts->sum(),
                'by_status' => collect(EventStatus::cases())->mapWithKeys(fn (EventStatus $s) => [$s->value => (int) ($counts[$s->value] ?? 0)]),
                'participants' => Participant::count(),
                'judges' => DB::table('event_judges')->distinct()->count('user_id'),
                'recent' => Event::query()->latest('updated_at')->limit(5)->get(['id', 'name', 'code', 'status', 'updated_at'])
                    ->map(fn (Event $e) => [
                        'id' => $e->id,
                        'name' => $e->name,
                        'code' => $e->code,
                        'status' => $e->status->value,
                        'updated_at' => $e->updated_at?->toIso8601String(),
                    ])->values(),
            ];
        }

        $activity = $gate->allows('audit.view')
            ? AuditLog::with('user:id,name')->latest('id')->limit(6)->get()->map(fn (AuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'actor' => $log->user?->name,
                'created_at' => $log->created_at?->toIso8601String(),
            ])->values()
            : null;

        return response()->json(['data' => ['users' => $users, 'events' => $events, 'activity' => $activity]]);
    }
}