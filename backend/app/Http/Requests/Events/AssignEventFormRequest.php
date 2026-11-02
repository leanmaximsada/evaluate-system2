<?php

namespace App\Http\Requests\Events;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AssignEventFormRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('events.manage') ?? false;
    }

    public function rules(): array
    {
        return [
            'form_id' => ['required', 'integer', Rule::exists('evaluation_forms', 'id')->whereNull('deleted_at')],
        ];
    }
}