<?php

namespace App\Http\Resources;

use App\Models\EventSponsor;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin EventSponsor */
class SponsorResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'tier' => $this->tier->value,
            'logo_url' => $this->logoUrl(),
            'display_order' => $this->display_order,
        ];
    }
}