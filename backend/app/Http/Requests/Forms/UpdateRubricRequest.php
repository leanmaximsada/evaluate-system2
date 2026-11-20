<?php

namespace App\Http\Requests\Forms;

use App\Services\RubricService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateRubricRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('forms.manage') ?? false;
    }

    public function rules(): array
    {
        return [
            'levels' => ['present', 'array', 'max:'.RubricService::MAX_LEVELS],
            'levels.*.name' => ['required', 'string', 'max:60'],
            'levels.*.name_km' => ['nullable', 'string', 'max:60'],
            'levels.*.min_percent' => ['required', 'numeric', 'between:0,100', 'decimal:0,2'],
            'levels.*.color' => ['required', Rule::in(RubricService::COLORS)],
            'levels.*.descriptions' => ['nullable', 'array'],
            'levels.*.descriptions.*' => ['nullable', 'string', 'max:500'],
        ];
    }
}