<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\EvaluationStatus;
use App\Enums\EventStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Results\PublishResultsRequest;
use App\Models\Evaluation;
use App\Models\Event;
use App\Models\Participant;
use App\Models\ParticipantResult;
use App\Models\ResultPublication;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\ResultExporter;
use App\Services\ResultPublicationService;
use App\Services\ResultService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ResultController extends Controller
{
    public function __construct(
        private readonly ResultService $results,
        private readonly ResultPublicationService $publications,
        private readonly ResultExporter $exporter,
        private readonly AuditLogger $audit,
    ) {}

    public function index(Event $event): JsonResponse
    {
        $rows = $this->results->rows($event);
        $judges = $event->judges()->count();

        $registered = array_values(array_filter($rows, fn (array $r) => $r['participant_status'] === 'registered'));
        $expected = count($registered) * $judges;
        $submitted = $registered === [] ? 0 : Evaluation::where('event_id', $event->id)
            ->where('status', EvaluationStatus::Submitted->value)
            ->whereIn('participant_id', array_column($registered, 'participant_id'))
            ->count();

        return response()->json(['data' => [
            'event' => ['id' => $event->id, 'name' => $event->name, 'code' => $event->code, 'status' => $event->status->value],
            'is_provisional' => $event->status !== EventStatus::Completed,
            'summary' => [
                'participants' => count($registered),
                'judges_assigned' => $judges,
                'evaluations_expected' => $expected,
                'evaluations_submitted' => $submitted,
                'completion_percent' => $expected > 0 ? round($submitted / $expected * 100, 1) : 0,
            ],
            'publication' => $this->publications->summary($event, $rows),
            'rows' => $rows,
        ]]);
    }

    public function show(Event $event, Participant $participant): JsonResponse
    {
        $result = ParticipantResult::where('event_id', $event->id)->where('participant_id', $participant->id)->first();

        $evaluations = Evaluation::where('participant_id', $participant->id)
            ->with(['scores', 'formVersion.criteria', 'revisions.changedBy:id,name'])
            ->get()
            ->keyBy('judge_id');

        $judges = $event->judges()->orderBy('name')->get()->map(function (User $judge) use ($evaluations) {
            /** @var Evaluation|null $evaluation */
            $evaluation = $evaluations->get($judge->id);
            $submitted = $evaluation && $evaluation->status === EvaluationStatus::Submitted;
            $scoreMap = $evaluation ? $evaluation->scores->keyBy('evaluation_criterion_id') : collect();

            return [
                'judge' => ['id' => $judge->id, 'name' => $judge->name, 'email' => $judge->email],
                'status' => $evaluation ? $evaluation->status->value : 'not_started',
                'submitted_at' => $evaluation?->submitted_at?->toIso8601String(),
                'total_score' => $submitted ? $evaluation->total_score : null,
                'revision' => $evaluation?->revision,
                // Draft scores are not final, so only submitted scores are shown.
                'scores' => $submitted
                    ? $evaluation->formVersion->criteria
                        ->filter(fn ($c) => $c->is_active || $scoreMap->has($c->id))
                        ->map(fn ($c) => [
                            'criterion_id' => $c->id,
                            'name' => $c->name,
                            'min_score' => (float) $c->min_score,
                            'max_score' => (float) $c->max_score,
                            'weight' => (float) $c->weight,
                            'score' => $scoreMap->get($c->id)?->score,
                        ])->values()->all()
                    : [],
                'revisions' => $evaluation ? $evaluation->revisions->map(fn ($r) => [
                    'revision' => $r->revision,
                    'changed_by' => $r->changedBy?->name,
                    'reason' => $r->reason,
                    'previous_total' => $r->previous_total,
                    'previous_scores' => $r->previous_scores,
                    'created_at' => $r->created_at?->toIso8601String(),
                ])->values()->all() : [],
            ];
        })->values();

        return response()->json(['data' => [
            'participant' => [
                'id' => $participant->id, 'number' => $participant->number, 'name' => $participant->name,
                'team_name' => $participant->team_name, 'status' => $participant->status,
            ],
            'result' => $result ? [
                'aggregate_score' => $result->aggregate_score,
                'rank' => $result->rank,
                'is_tied' => $result->is_tied,
                'evaluations_submitted' => $result->evaluations_submitted,
                'judges_assigned' => $result->judges_assigned,
                'is_complete' => $result->is_complete,
                'calculated_at' => $result->calculated_at?->toIso8601String(),
            ] : null,
            'judges' => $judges,
        ]]);
    }

    public function recalculate(Request $request, Event $event): JsonResponse
    {
        $this->results->recalculate($event);
        $this->audit->log('results.recalculated', $event, ['event' => $event->code], $request->user());

        return $this->index($event);
    }

    public function publish(PublishResultsRequest $request, Event $event): JsonResponse
    {
        $publication = $this->publications->publish($event, $request->validated(), $request->user());

        return response()->json(['data' => $this->publications->present($publication)], 201);
    }

    public function unpublish(Request $request, Event $event): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:2000']]);

        $publication = $this->publications->unpublish($event, $data['reason'] ?? null, $request->user());

        return response()->json(['data' => $this->publications->present($publication)]);
    }

    public function publications(Event $event): JsonResponse
    {
        $items = ResultPublication::where('event_id', $event->id)->with('publisher:id,name')->orderByDesc('revision')->get()
            ->map(fn (ResultPublication $p) => $this->publications->present($p, true))->values();

        return response()->json(['data' => $items]);
    }

    public function export(Request $request, Event $event): StreamedResponse
    {
        $request->validate(['format' => ['required', 'in:csv']]);

        $rows = $this->results->rows($event);
        $publication = $this->publications->summary($event, $rows);

        $this->audit->log('results.exported', $event, ['event' => $event->code, 'format' => 'csv'], $request->user());

        return $this->exporter->csv($event, $rows, $publication['status'] === 'none' ? 'not published' : $publication['status']);
    }
}