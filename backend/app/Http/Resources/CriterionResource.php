<?php

namespace App\Http\Resources;

use App\Models\EvaluationCriterion;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin EvaluationCriterion */
class CriterionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'min_score' => (float) $this->min_score,
            'max_score' => (float) $this->max_score,
            'weight' => (float) $this->weight,
            'display_order' => $this->display_order,
            'is_required' => $this->is_required,
            'is_active' => $this->is_active,
        ];
    }
}