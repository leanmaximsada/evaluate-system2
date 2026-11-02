<?php

namespace App\Http\Requests\Events;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveParticipantRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('events.manage') ?? false;
    }

    protected function prepareForValidation(): void
    {
        if (is_int($this->input('number'))) {
            $this->merge(['number' => (string) $this->input('number')]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'number' => [
                'required', 'string', 'max:20',
                Rule::unique('participants', 'number')
                    ->where('event_id', $this->route('event')->id)
                    ->ignore($this->route('participant')),
            ],
            'team_name' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'status' => ['sometimes', Rule::in(['registered', 'withdrawn', 'disqualified'])],
        ];
    }
}