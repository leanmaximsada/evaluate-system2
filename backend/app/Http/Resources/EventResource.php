<?php

namespace App\Http\Resources;

use App\Enums\EventStatus;
use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Event */
class EventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $local = fn ($date) => $date?->copy()->setTimezone($this->timezone)->format('Y-m-d\TH:i');

        return [
            'id' => $this->id,
            'name' => $this->name,
            'code' => $this->code,
            'description' => $this->description,
            'venue' => $this->venue,
            'category' => $this->category,
            'timezone' => $this->timezone,
            'starts_at' => $this->starts_at?->toIso8601String(),
            'ends_at' => $this->ends_at?->toIso8601String(),
            'starts_at_local' => $local($this->starts_at),
            'ends_at_local' => $local($this->ends_at),
            'status' => $this->status->value,
            'allowed_transitions' => array_map(fn (EventStatus $s) => $s->value, $this->status->allowedTransitions()),
            'is_closed' => in_array($this->status, [EventStatus::Completed, EventStatus::Cancelled], true),
            'is_structure_locked' => $this->status !== EventStatus::Draft && $this->status !== EventStatus::Upcoming,
            'participants_count' => $this->whenCounted('participants'),
            'judges_count' => $this->whenCounted('judges'),
            'created_by' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'evaluation_form_version_id' => $this->evaluation_form_version_id,
            'form' => $this->whenLoaded('formVersion', fn () => $this->formVersion ? [
                'id' => $this->formVersion->evaluation_form_id,
                'name' => $this->formVersion->form?->name,
                'version_id' => $this->formVersion->id,
                'version_number' => $this->formVersion->version_number,
            ] : null),
        ];
    }
}