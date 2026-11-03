<?php

namespace App\Http\Requests\Results;

use Illuminate\Foundation\Http\FormRequest;

class PublishResultsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('results.publish') ?? false;
    }

    public function rules(): array
    {
        return [
            'confirm' => ['required', 'accepted'],
            'visibility' => ['required', 'in:rank_and_score,rank_only'],
            'accept_incomplete' => ['sometimes', 'boolean'],
            'correction_reason' => ['nullable', 'string', 'max:2000'],
        ];
    }
}