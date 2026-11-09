<?php

namespace App\Http\Requests\Events;

use Illuminate\Foundation\Http\FormRequest;

class SaveOrganizationLogoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('events.manage') ?? false;
    }

    public function rules(): array
    {
        // SVG is refused on purpose: it can carry scripts.
        return ['logo' => ['required', 'file', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048', 'dimensions:max_width=4000,max_height=4000']];
    }
}