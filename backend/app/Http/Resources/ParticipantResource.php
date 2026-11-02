<?php

namespace App\Http\Resources;

use App\Models\Participant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Participant */
class ParticipantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'event_id' => $this->event_id,
            'name' => $this->name,
            'number' => $this->number,
            'team_name' => $this->team_name,
            'description' => $this->description,
            'presentation_order' => $this->presentation_order,
            'status' => $this->status,
        ];
    }
}