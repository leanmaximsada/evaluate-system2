<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\EventStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Events\ListEventsRequest;
use App\Http\Requests\Events\SaveEventRequest;
use App\Http\Resources\EventResource;
use App\Models\Event;
use App\Services\EventService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use App\Http\Requests\Events\AssignEventFormRequest;
use App\Models\EvaluationForm;
class EventController extends Controller
{
    public function __construct(private readonly EventService $events) {}

    public function index(ListEventsRequest $request): AnonymousResourceCollection
    {
        $query = Event::query()
            ->withCount(['participants', 'judges'])
            ->when($request->validated('search'), function (Builder $q, string $term) {
                $like = '%'.addcslashes($term, '\\%_').'%';
                $q->where(fn (Builder $q) => $q->where('name', 'ilike', $like)->orWhere('code', 'ilike', $like));
            })
            ->when($request->validated('status'), fn (Builder $q, string $status) => $q->where('status', $status))
            ->orderBy($request->validated('sort') ?? 'starts_at', $request->validated('direction') ?? 'desc')
            ->orderBy('id');

        return EventResource::collection($query->paginate($request->validated('per_page') ?? 15)->withQueryString());
    }

    public function show(Event $event): EventResource
    {
        return $this->present($event);
    }

    public function store(SaveEventRequest $request): JsonResponse
    {
        $event = $this->events->create($request->validated(), $request->user());

        return $this->present($event)->response()->setStatusCode(201);
    }

    public function update(SaveEventRequest $request, Event $event): EventResource
    {
        return $this->present($this->events->update($event, $request->validated(), $request->user()));
    }

    public function updateStatus(Request $request, Event $event): EventResource
    {
        $data = $request->validate(['status' => ['required', Rule::enum(EventStatus::class)]]);

        return $this->present($this->events->changeStatus($event, EventStatus::from($data['status']), $request->user()));
    }

        public function assignForm(AssignEventFormRequest $request, Event $event): EventResource
    {
        $form = EvaluationForm::findOrFail($request->validated('form_id'));

        return $this->present($this->events->assignForm($event, $form, $request->user()));
    }

    public function clearForm(Request $request, Event $event): EventResource
    {
        return $this->present($this->events->clearForm($event, $request->user()));
    }

    private function present(Event $event): EventResource
    {
        return EventResource::make($event->loadCount(['participants', 'judges'])->load(['creator:id,name', 'formVersion.form']));
    }
}