<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Events\SaveParticipantRequest;
use App\Http\Resources\ParticipantResource;
use App\Models\Event;
use App\Models\Participant;
use App\Services\ParticipantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class ParticipantController extends Controller
{
    public function __construct(private readonly ParticipantService $participants) {}

    public function index(Event $event): AnonymousResourceCollection
    {
        return ParticipantResource::collection(
            Participant::where('event_id', $event->id)->orderBy('presentation_order')->get()
        );
    }

    public function store(SaveParticipantRequest $request, Event $event): JsonResponse
    {
        $participant = $this->participants->create($event, $request->validated(), $request->user());

        return ParticipantResource::make($participant)->response()->setStatusCode(201);
    }

    public function update(SaveParticipantRequest $request, Event $event, Participant $participant): ParticipantResource
    {
        return ParticipantResource::make($this->participants->update($event, $participant, $request->validated(), $request->user()));
    }

    public function destroy(Request $request, Event $event, Participant $participant): Response
    {
        $this->participants->delete($event, $participant, $request->user());

        return response()->noContent();
    }

    public function reorder(Request $request, Event $event): AnonymousResourceCollection
    {
        $data = $request->validate(['order' => ['required', 'array', 'min:1'], 'order.*' => ['integer']]);

        $this->participants->reorder($event, $data['order'], $request->user());

        return $this->index($event);
    }
}