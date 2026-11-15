<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Services\RevealService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RevealController extends Controller
{
    public function __construct(private readonly RevealService $reveal) {}

    public function show(Event $event): JsonResponse
    {
        return response()->json(['data' => $this->reveal->adminState($event)])->header('Cache-Control', 'no-store');
    }

    public function update(Request $request, Event $event): JsonResponse
    {
        $data = $request->validate(['action' => ['required', 'in:next,undo,all,reset']]);

        $this->reveal->apply($event, $data['action'], $request->user());

        return $this->show($event);
    }
}