<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Events\SaveOrganizationLogoRequest;
use App\Http\Requests\Events\UpdateDisplayRequest;
use App\Models\Event;
use App\Services\EventDisplayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventDisplayController extends Controller
{
    public function __construct(private readonly EventDisplayService $display) {}

    public function preview(Event $event): JsonResponse
    {
        return response()->json(['data' => $this->display->preview($event)])->header('Cache-Control', 'no-store');
    }

    public function update(UpdateDisplayRequest $request, Event $event): JsonResponse
    {
        return $this->present($this->display->update($event, $request->validated(), $request->user()));
    }

    /** POST, not PUT: PHP does not read file uploads from PUT requests. */
    public function uploadLogo(SaveOrganizationLogoRequest $request, Event $event): JsonResponse
    {
        return $this->present($this->display->setLogo($event, $request->file('logo'), $request->user()));
    }

    public function removeLogo(Request $request, Event $event): JsonResponse
    {
        return $this->present($this->display->removeLogo($event, $request->user()));
    }

    private function present(Event $event): JsonResponse
    {
        return response()->json(['data' => [
            'public_subtitle' => $event->public_subtitle,
            'organization_name' => $event->organization_name,
            'organization_logo_url' => $event->organizationLogoUrl(),
            'display_visibility' => $event->display_visibility,
        ]]);
    }
}