<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Forms\SaveCriterionRequest;
use App\Http\Resources\CriterionResource;
use App\Models\EvaluationCriterion;
use App\Models\EvaluationForm;
use App\Models\EvaluationFormVersion;
use App\Services\EvaluationFormService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class FormCriterionController extends Controller
{
    public function __construct(private readonly EvaluationFormService $forms) {}

    public function store(SaveCriterionRequest $request, EvaluationForm $form, EvaluationFormVersion $version): JsonResponse
    {
        $criterion = $this->forms->addCriterion($version, $request->validated(), $request->user());

        return CriterionResource::make($criterion)->response()->setStatusCode(201);
    }

    public function update(SaveCriterionRequest $request, EvaluationForm $form, EvaluationFormVersion $version, EvaluationCriterion $criterion): CriterionResource
    {
        return CriterionResource::make($this->forms->updateCriterion($version, $criterion, $request->validated(), $request->user()));
    }

    public function destroy(Request $request, EvaluationForm $form, EvaluationFormVersion $version, EvaluationCriterion $criterion): Response
    {
        $this->forms->deleteCriterion($version, $criterion, $request->user());

        return response()->noContent();
    }

    public function reorder(Request $request, EvaluationForm $form, EvaluationFormVersion $version): AnonymousResourceCollection
    {
        $data = $request->validate(['order' => ['required', 'array', 'min:1'], 'order.*' => ['integer']]);

        $this->forms->reorderCriteria($version, $data['order'], $request->user());

        return CriterionResource::collection($version->criteria()->get());
    }
}