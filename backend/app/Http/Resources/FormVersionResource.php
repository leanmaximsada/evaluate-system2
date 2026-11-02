<?php

namespace App\Http\Resources;

use App\Models\EvaluationFormVersion;
use App\Services\EvaluationFormService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin EvaluationFormVersion */
class FormVersionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $withCriteria = $this->relationLoaded('criteria');

        return [
            'id' => $this->id,
            'evaluation_form_id' => $this->evaluation_form_id,
            'version_number' => $this->version_number,
            'status' => $this->status,
            'is_weighted' => $this->is_weighted,
            'published_at' => $this->published_at?->toIso8601String(),
            'criteria_count' => $this->whenCounted('criteria'),
            'criteria' => CriterionResource::collection($this->whenLoaded('criteria')),
            'weight_total' => $this->when($withCriteria, fn () => round($this->criteria->where('is_active', true)->sum(fn ($c) => (float) $c->weight), 2)),
            // Computed on the server so the browser never re-implements the publishing rules.
            'publish_issues' => $this->when(
                $withCriteria && $this->status === 'draft',
                fn () => app(EvaluationFormService::class)->publishIssues($this->resource),
            ),
        ];
    }
}