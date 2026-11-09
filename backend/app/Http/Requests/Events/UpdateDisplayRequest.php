<?php

namespace App\Http\Requests\Events;

use Illuminate\Foundation\Http\FormRequest;

class UpdateDisplayRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('events.manage') ?? false;
    }

    public function rules(): array
    {
        return [
            'public_subtitle' => ['sometimes', 'nullable', 'string', 'max:500'],
            'organization_name' => ['sometimes', 'nullable', 'string', 'max:150'],
            'display_visibility' => ['sometimes', 'in:rank_and_score,rank_only'],
        ];
    }
}