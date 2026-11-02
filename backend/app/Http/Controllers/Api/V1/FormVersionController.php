<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Forms\UpdateVersionRequest;
use App\Http\Resources\FormVersionResource;
use App\Models\EvaluationForm;
use App\Models\EvaluationFormVersion;
use App\Services\EvaluationFormService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FormVersionController extends Controller
{
    public function __construct(private readonly EvaluationFormService $forms) {}

    public function show(EvaluationForm $form, EvaluationFormVersion $version): FormVersionResource
    {
        return FormVersionResource::make($version->load('criteria'));
    }

    public function store(Request $request, EvaluationForm $form): JsonResponse
    {
        $version = $this->forms->createVersion($form, $request->user());

        return FormVersionResource::make($version->load('criteria'))->response()->setStatusCode(201);
    }

    public function update(UpdateVersionRequest $request, EvaluationForm $form, EvaluationFormVersion $version): FormVersionResource
    {
        return FormVersionResource::make(
            $this->forms->updateVersion($version, $request->validated(), $request->user())->load('criteria')
        );
    }

    public function publish(Request $request, EvaluationForm $form, EvaluationFormVersion $version): FormVersionResource
    {
        return FormVersionResource::make($this->forms->publish($version, $request->user())->load('criteria'));
    }
}