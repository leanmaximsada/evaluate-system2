<?php

namespace App\Http\Resources;

use App\Models\EvaluationForm;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin EvaluationForm */
class EvaluationFormResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $versions = $this->relationLoaded('versions') ? $this->versions : null;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'status' => $this->status->value,
            'latest_published_version' => $versions?->where('status', 'published')->max('version_number'),
            'has_draft' => $versions?->contains('status', 'draft'),
            'versions_count' => $versions?->count(),
            'versions' => FormVersionResource::collection($this->whenLoaded('versions')),
            'created_by' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}