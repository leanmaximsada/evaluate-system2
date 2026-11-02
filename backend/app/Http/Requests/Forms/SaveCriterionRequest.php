<?php

namespace App\Http\Requests\Forms;

use Illuminate\Foundation\Http\FormRequest;

class SaveCriterionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('forms.manage') ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'min_score' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:1000000'],
            'max_score' => ['required', 'numeric', 'decimal:0,2', 'gt:min_score', 'max:1000000'],
            'weight' => ['nullable', 'numeric', 'decimal:0,2', 'between:0,100'],
            'is_required' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}