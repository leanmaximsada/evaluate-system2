<?php

namespace Tests\Concerns;

use App\Enums\EventStatus;
use App\Models\EvaluationFormVersion;
use App\Models\Event;
use App\Models\Participant;
use App\Models\User;
use Illuminate\Support\Collection;

/** Needs the CreatesForms trait in the same test class. */
trait CreatesScoringFixtures
{
    /**
     * An event with a published form, participants and assigned judges.
     *
     * @return array{0: Event, 1: EvaluationFormVersion, 2: Collection, 3: Collection, 4: User} event, version, participants, judges, admin
     */
    protected function scoringEvent(
        int $participants = 3,
        int $judges = 2,
        array $weights = [60, 40],
        array $policy = [],
        bool $weighted = true,
        EventStatus $status = EventStatus::InProgress,
    ): array {
        $admin = User::factory()->admin()->create();
        $version = $this->publishedVersion($admin, $weights, $weighted);

        $event = Event::factory()->withStatus($status)->create([
            'created_by' => $admin->id,
            'evaluation_form_version_id' => $version->id,
            'scoring_policy' => array_merge([
                'min_score' => 0, 'max_score' => 100, 'score_precision' => 2, 'tie_policy' => 'standard',
                'show_tie_indicator' => true, 'aggregation' => 'mean', 'missing_scores' => 'exclude',
                'form_version_id' => $version->id,
            ], $policy),
        ]);

        $people = collect(range(1, $participants))->map(fn (int $i) => Participant::factory()->create([
            'event_id' => $event->id, 'number' => (string) $i, 'presentation_order' => $i,
        ]));

        $panel = User::factory()->judge()->count($judges)->create();
        foreach ($panel as $judge) {
            $event->judges()->attach($judge->id, ['assigned_by' => $admin->id]);
        }

        return [$event, $version, $people, $panel, $admin];
    }

    /**
     * @param  list<int|string|float>  $values  one score per criterion, in form order
     * @return array<int, int|string|float>
     */
    protected function scoreMap(EvaluationFormVersion $version, array $values): array
    {
        return $version->criteria()->get()->pluck('id')->values()
            ->mapWithKeys(fn ($id, $index) => [$id => $values[$index]])->all();
    }
}