<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class UpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && Gate::forUser($this->user())->allows('settings.manage');
    }

    public function rules(): array
    {
        return [
            'general' => ['required', 'array'],
            'general.system_name' => ['required', 'string', 'max:100'],
            'general.default_language' => ['required', Rule::in(['en', 'km'])],
            'general.timezone' => ['required', 'timezone:all'],
            'general.date_format' => ['required', Rule::in(['Y-m-d', 'd/m/Y', 'm/d/Y', 'd M Y'])],
            'general.time_format' => ['required', Rule::in(['24h', '12h'])],
            'general.pagination_size' => ['required', 'integer', 'between:5,100'],

            'evaluation' => ['required', 'array'],
            'evaluation.min_score' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'evaluation.max_score' => ['required', 'numeric', 'gt:evaluation.min_score', 'max:1000000'],
            'evaluation.score_precision' => ['required', 'integer', 'between:0,2'],
            'evaluation.tie_policy' => ['required', Rule::in(['standard', 'dense'])],
            'evaluation.show_tie_indicator' => ['required', 'boolean'],
            'evaluation.live_provisional_enabled' => ['required', 'boolean'],
            'evaluation.default_result_visibility' => ['required', Rule::in(['rank_and_score', 'rank_only', 'hidden'])],
        ];
    }
}