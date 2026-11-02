<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Forms\ListFormsRequest;
use App\Http\Requests\Forms\SaveFormRequest;
use App\Http\Resources\EvaluationFormResource;
use App\Models\EvaluationForm;
use App\Services\EvaluationFormService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class EvaluationFormController extends Controller
{
    public function __construct(private readonly EvaluationFormService $forms) {}

    public function index(ListFormsRequest $request): AnonymousResourceCollection
    {
        $query = EvaluationForm::query()
            ->with('versions')
            ->when($request->validated('search'), function (Builder $q, string $term) {
                $q->where('name', 'ilike', '%'.addcslashes($term, '\\%_').'%');
            })
            ->when($request->validated('status'), fn (Builder $q, string $status) => $q->where('status', $status))
            ->orderBy($request->validated('sort') ?? 'updated_at', $request->validated('direction') ?? 'desc')
            ->orderBy('id');

        return EvaluationFormResource::collection($query->paginate($request->validated('per_page') ?? 15)->withQueryString());
    }

    public function show(EvaluationForm $form): EvaluationFormResource
    {
        return $this->present($form);
    }

    public function store(SaveFormRequest $request): JsonResponse
    {
        $form = $this->forms->create($request->validated(), $request->user());

        return $this->present($form)->response()->setStatusCode(201);
    }

    public function update(SaveFormRequest $request, EvaluationForm $form): EvaluationFormResource
    {
        return $this->present($this->forms->updateDetails($form, $request->validated(), $request->user()));
    }

    public function updateStatus(Request $request, EvaluationForm $form): EvaluationFormResource
    {
        $data = $request->validate(['status' => ['required', 'in:active,inactive,draft']]);

        return $this->present($this->forms->setStatus($form, FormStatus::from($data['status']), $request->user()));
    }

    private function present(EvaluationForm $form): EvaluationFormResource
    {
        return EvaluationFormResource::make(
            $form->load(['creator:id,name', 'versions' => fn ($q) => $q->withCount('criteria')])
        );
    }
}