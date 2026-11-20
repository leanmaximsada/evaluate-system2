<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Forms\UpdateRubricRequest;
use App\Models\EvaluationForm;
use App\Models\EvaluationFormVersion;
use App\Services\RubricService;
use Illuminate\Http\JsonResponse;

class RubricController extends Controller
{
    public function __construct(private readonly RubricService $rubric) {}

    public function show(EvaluationForm $form, EvaluationFormVersion $version): JsonResponse
    {
        $this->belongs($form, $version);

        return response()->json(['data' => ['levels' => $this->rubric->present($this->rubric->levels($version))]]);
    }

    public function update(UpdateRubricRequest $request, EvaluationForm $form, EvaluationFormVersion $version): JsonResponse
    {
        $this->belongs($form, $version);

        $levels = $this->rubric->save($version, $request->validated('levels'), $request->user());

        return response()->json(['data' => ['levels' => $this->rubric->present($levels)]]);
    }

    /** A version is only reachable through the form it belongs to. */
    private function belongs(EvaluationForm $form, EvaluationFormVersion $version): void
    {
        abort_unless((int) $version->evaluation_form_id === (int) $form->id, 404);
    }
}