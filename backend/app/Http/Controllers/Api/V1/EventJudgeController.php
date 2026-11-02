<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\JudgeResource;
use App\Models\Event;
use App\Models\User;
use App\Services\JudgeAssignmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class EventJudgeController extends Controller
{
    public function __construct(private readonly JudgeAssignmentService $judges) {}

    public function index(Event $event): AnonymousResourceCollection
    {
        return JudgeResource::collection($event->judges()->orderBy('name')->get());
    }

    public function candidates(Request $request, Event $event): AnonymousResourceCollection
    {
        $data = $request->validate(['search' => ['nullable', 'string', 'max:100']]);

        return JudgeResource::collection($this->judges->candidates($event, $data['search'] ?? null));
    }

    public function store(Request $request, Event $event): JsonResponse
    {
        $data = $request->validate(['user_id' => ['required', 'integer', 'exists:users,id']]);

        $judge = $this->judges->assign($event, User::findOrFail($data['user_id']), $request->user());

        return JudgeResource::make($judge)->response()->setStatusCode(201);
    }

    public function destroy(Request $request, Event $event, User $user): Response
    {
        $this->judges->unassign($event, $user, $request->user());

        return response()->noContent();
    }
}