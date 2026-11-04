<?php

namespace App\Http\Requests\Judge;

use Illuminate\Foundation\Http\FormRequest;

class JudgeScoresRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isJudge() ?? false;
    }

    public function rules(): array
    {
        // Each score is validated against its criterion's range by EvaluationService.
        return ['scores' => ['required', 'array', 'max:100']];
    }
}