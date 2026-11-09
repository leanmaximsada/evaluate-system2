<?php

namespace App\Http\Requests\Events;

use App\Enums\SponsorTier;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveSponsorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('events.manage') ?? false;
    }

    public function rules(): array
    {
        $creating = $this->route('sponsor') === null;

        return [
            'name' => ['required', 'string', 'max:150'],
            'tier' => ['required', Rule::enum(SponsorTier::class)],
            // SVG is refused on purpose: it can carry scripts.
            'logo' => [$creating ? 'required' : 'nullable', 'file', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048', 'dimensions:max_width=4000,max_height=4000'],
        ];
    }
}