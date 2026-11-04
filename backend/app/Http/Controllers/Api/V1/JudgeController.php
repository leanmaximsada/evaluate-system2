<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\EvaluationStatus;
use App\Enums\EventStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Judge\JudgeScoresRequest;
use App\Http\Resources\CriterionResource;
use App\Models\Evaluation;
use App\Models\Event;
use App\Models\Participant;
use App\Services\EvaluationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The judge portal API. A judge only ever sees their own evaluations: never other judges' scores,
 * aggregates or ranks.
 */
class JudgeController extends Controller
{
    public function __construct(private readonly EvaluationService $evaluations) {}

    public function events(Request $request): JsonResponse
    {
        $judge = $request->user();
        $events = $judge->assignedEvents()
            ->where('events.status', EventStatus::InProgress->value)
            ->orderBy('events.starts_at')
            ->get();
        $ids = $events->pluck('id');

        $totals = Participant::whereIn('event_id', $ids)->where('status', 'registered')
            ->selectRaw('event_id, count(*) as total')->groupBy('event_id')->pluck('total', 'event_id');

        $mine = DB::table('evaluations')
            ->join('participants', 'participants.id', '=', 'evaluations.participant_id')
            ->where('evaluations.judge_id', $judge->id)
            ->whereIn('evaluations.event_id', $ids)
            ->where('participants.status', 'registered')
            ->selectRaw('evaluations.event_id as event_id, evaluations.status as status, count(*) as c')
            ->groupBy('evaluations.event_id', 'evaluations.status')
            ->get()->groupBy('event_id');

        $count = function (int $eventId, string $status) use ($mine): int {
            $row = ($mine->get($eventId) ?? collect())->firstWhere('status', $status);

            return $row ? (int) $row->c : 0;
        };

        return response()->json(['data' => $events->map(fn (Event $e) => [
            'id' => $e->id,
            'name' => $e->name,
            'code' => $e->code,
            'venue' => $e->venue,
            'starts_at_local' => $e->starts_at?->copy()->setTimezone($e->timezone)->format('Y-m-d\TH:i'),
            'participants_total' => (int) ($totals[$e->id] ?? 0),
            'submitted' => $count($e->id, 'submitted'),
            'drafts' => $count($e->id, 'draft'),
        ])->values()]);
    }

    public function show(Request $request, Event $event): JsonResponse
    {
        $event = $this->open($request, $event);
        $version = $event->formVersion()->with('criteria')->firstOrFail();

        $evaluations = Evaluation::where('event_id', $event->id)->where('judge_id', $request->user()->id)->get()->keyBy('participant_id');

        $participants = Participant::where('event_id', $event->id)->where('status', 'registered')
            ->orderBy('presentation_order')->get()
            ->map(function (Participant $p) use ($evaluations) {
                $evaluation = $evaluations->get($p->id);
                $submitted = $evaluation && $evaluation->status === EvaluationStatus::Submitted;

                return [
                    'id' => $p->id,
                    'number' => $p->number,
                    'name' => $p->name,
                    'team_name' => $p->team_name,
                    'presentation_order' => $p->presentation_order,
                    'evaluation_status' => $evaluation ? $evaluation->status->value : 'not_started',
                    'total_score' => $submitted ? $evaluation->total_score : null,
                ];
            })->values();

        return response()->json(['data' => [
            'event' => ['id' => $event->id, 'name' => $event->name, 'code' => $event->code, 'description' => $event->description, 'venue' => $event->venue],
            'is_weighted' => $version->is_weighted,
            'criteria' => $this->criteria($version),
            'participants' => $participants,
        ]]);
    }

    public function participant(Request $request, Event $event, Participant $participant): JsonResponse
    {
        $event = $this->open($request, $event);
        abort_unless($participant->status === 'registered', 404);

        $version = $event->formVersion()->with('criteria')->firstOrFail();
        $evaluation = Evaluation::where('participant_id', $participant->id)->where('judge_id', $request->user()->id)->with('scores')->first();

        return response()->json(['data' => [
            'event' => ['id' => $event->id, 'name' => $event->name, 'code' => $event->code],
            'participant' => [
                'id' => $participant->id, 'number' => $participant->number, 'name' => $participant->name,
                'team_name' => $participant->team_name, 'description' => $participant->description,
            ],
            'is_weighted' => $version->is_weighted,
            'criteria' => $this->criteria($version),
            'evaluation' => $this->evaluationData($evaluation),
        ]]);
    }

    public function saveDraft(JudgeScoresRequest $request, Event $event, Participant $participant): JsonResponse
    {
        $event = $this->open($request, $event);
        $judge = $request->user();

        $evaluation = $this->evaluations->saveDraft($event, $participant, $judge, $this->scores($request), $judge);

        return response()->json(['data' => ['evaluation' => $this->evaluationData($evaluation->load('scores'))]]);
    }

    public function submit(JudgeScoresRequest $request, Event $event, Participant $participant): JsonResponse
    {
        $request->validate(['confirm' => ['accepted']]);

        $event = $this->open($request, $event);
        $judge = $request->user();

        $evaluation = $this->evaluations->submit($event, $participant, $judge, $this->scores($request), $judge);

        return response()->json(['data' => ['evaluation' => $this->evaluationData($evaluation->load('scores'))]]);
    }

    /** 404 (not 403) for events the judge is not assigned to, so event ids cannot be probed. */
    private function open(Request $request, Event $event): Event
    {
        $assigned = $event->judges()->where('users.id', $request->user()->id)->exists();
        abort_unless($assigned && $event->status === EventStatus::InProgress, 404);

        return $event;
    }

    /** @return array<int, string|int|float> Blank and non-scalar values are dropped, never treated as zero. */
    private function scores(Request $request): array
    {
        return collect($request->input('scores', []))
            ->filter(fn ($value) => is_scalar($value) && trim((string) $value) !== '')
            ->map(fn ($value) => is_string($value) ? trim($value) : $value)
            ->all();
    }

    /** @return list<array<string, mixed>> */
    private function criteria($version): array
    {
        return $version->criteria->where('is_active', true)->values()
            ->map(fn ($criterion) => (new CriterionResource($criterion))->resolve())->all();
    }

    /** @return array<string, mixed> */
    private function evaluationData(?Evaluation $evaluation): array
    {
        if (! $evaluation) {
            return ['status' => 'not_started', 'scores' => (object) [], 'total_score' => null, 'submitted_at' => null, 'revision' => null];
        }

        $submitted = $evaluation->status === EvaluationStatus::Submitted;

        return [
            'status' => $evaluation->status->value,
            'scores' => (object) $evaluation->scores->mapWithKeys(fn ($s) => [$s->evaluation_criterion_id => (string) $s->score])->all(),
            'total_score' => $submitted ? $evaluation->total_score : null,
            'submitted_at' => $evaluation->submitted_at?->toIso8601String(),
            'revision' => $evaluation->revision,
        ];
    }
}