<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Events\SaveSponsorRequest;
use App\Http\Resources\SponsorResource;
use App\Models\Event;
use App\Models\EventSponsor;
use App\Services\SponsorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class SponsorController extends Controller
{
    public function __construct(private readonly SponsorService $sponsors) {}

    public function index(Event $event): AnonymousResourceCollection
    {
        return SponsorResource::collection($this->sponsors->all($event));
    }

    public function store(SaveSponsorRequest $request, Event $event): JsonResponse
    {
        $sponsor = $this->sponsors->create($event, $request->validated(), $request->file('logo'), $request->user());

        return SponsorResource::make($sponsor)->response()->setStatusCode(201);
    }

    /** POST, not PUT: PHP does not read file uploads from PUT requests. */
    public function update(SaveSponsorRequest $request, Event $event, EventSponsor $sponsor): SponsorResource
    {
        $this->belongs($event, $sponsor);
        return SponsorResource::make($this->sponsors->update($event, $sponsor, $request->validated(), $request->file('logo'), $request->user()));
    }

    public function destroy(Request $request, Event $event, EventSponsor $sponsor): Response
    {
        $this->belongs($event, $sponsor);
        $this->sponsors->delete($event, $sponsor, $request->user());

        return response()->noContent();
    }

    public function reorder(Request $request, Event $event): AnonymousResourceCollection
    {
        $data = $request->validate(['order' => ['required', 'array', 'min:1'], 'order.*' => ['integer']]);

        $this->sponsors->reorder($event, $data['order'], $request->user());

        return $this->index($event);
    }



        /** A sponsor is only reachable through the event it belongs to. */
    private function belongs(Event $event, EventSponsor $sponsor): void
    {
        abort_unless($sponsor->event_id === $event->id, 404);
    }
}