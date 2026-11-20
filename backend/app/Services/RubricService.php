<?php

namespace App\Services;

use App\Models\EvaluationCriterion;
use App\Models\EvaluationFormVersion;
use App\Models\User;
use BackedEnum;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * A rubric names performance levels (Superior, Excellent, ...) by where each one starts, as a percentage
 * of a criterion's score range. It guides judges and labels results. Scores themselves stay numbers.
 * The rubric lives on the form version, so a published version's rubric never changes.
 */
class RubricService
{
    public const COLORS = ['green', 'blue', 'amber', 'orange', 'red', 'slate', 'purple'];
    public const MIN_LEVELS = 2;
    public const MAX_LEVELS = 8;

    public function __construct(private readonly AuditLogger $audit, private readonly ScoringService $scoring) {}

    /**
     * @return list<array{name: string, name_km: ?string, min_percent: string, color: string, descriptions: array<int, string>}>
     *                                                                                                                         Highest level first.
     */
    public function levels(EvaluationFormVersion $version): array
    {
        $raw = $version->rubric['levels'] ?? [];
        if (! is_array($raw)) {
            return [];
        }

        $levels = [];
        foreach ($raw as $level) {
            if (! is_array($level)) {
                continue;
            }

            $levels[] = [
                'name' => (string) ($level['name'] ?? ''),
                'name_km' => isset($level['name_km']) && $level['name_km'] !== '' ? (string) $level['name_km'] : null,
                'min_percent' => bcadd((string) ($level['min_percent'] ?? '0'), '0', 2),
                'color' => in_array($level['color'] ?? '', self::COLORS, true) ? $level['color'] : 'slate',
                'descriptions' => is_array($level['descriptions'] ?? null) ? array_map('strval', $level['descriptions']) : [],
            ];
        }

        usort($levels, fn (array $a, array $b) => bccomp($b['min_percent'], $a['min_percent'], 2));

        return $levels;
    }

    /** JSON-friendly form: descriptions are always an object. @param list<array<string, mixed>> $levels */
    public function present(array $levels): array
    {
        return array_map(fn (array $level) => array_merge($level, ['descriptions' => (object) $level['descriptions']]), $levels);
    }

    /** What a judge may see, or null when the form has no rubric. */
    public function forJudge(EvaluationFormVersion $version): ?array
    {
        $levels = $this->levels($version);

        return $levels === [] ? null : $this->present($levels);
    }

    /**
     * Replaces the rubric of a draft version. An empty list removes it.
     *
     * @param  list<array<string, mixed>>  $levels
     * @return list<array<string, mixed>>
     */
    public function save(EvaluationFormVersion $version, array $levels, User $actor): array
    {
        return DB::transaction(function () use ($version, $levels, $actor) {
            $version = EvaluationFormVersion::query()->whereKey($version->id)->lockForUpdate()->firstOrFail();

            $status = $version->status instanceof BackedEnum ? $version->status->value : $version->status;
            if ($status !== 'draft') {
                throw ValidationException::withMessages(['version' => [__('This version is published and cannot be changed.')]]);
            }

            $clean = $this->clean($version, $levels);
            $version->rubric = $clean === [] ? null : ['levels' => $clean];
            $version->save();

            $this->audit->log('form.rubric_updated', $version, ['levels' => count($clean)], $actor);

            return $this->levels($version);
        });
    }

    /** Called when a new version is created from an older one. Criteria get new ids, so descriptions are remapped. */
    public function copyToNewVersion(EvaluationFormVersion $from, EvaluationFormVersion $to): void
    {
        $levels = $this->levels($from);
        if ($levels === []) {
            return;
        }

        $old = $from->criteria()->orderBy('display_order')->orderBy('id')->pluck('id')->all();
        $new = $to->criteria()->orderBy('display_order')->orderBy('id')->pluck('id')->all();

        $map = [];
        foreach ($old as $index => $id) {
            if (isset($new[$index])) {
                $map[(int) $id] = (int) $new[$index];
            }
        }

        foreach ($levels as &$level) {
            $mapped = [];
            foreach ($level['descriptions'] as $criterionId => $text) {
                if (isset($map[(int) $criterionId])) {
                    $mapped[$map[(int) $criterionId]] = $text;
                }
            }
            $level['descriptions'] = $mapped;
        }
        unset($level);

        $to->rubric = ['levels' => $levels];
        $to->save();
    }

    /** @return array{name: string, name_km: ?string, color: string}|null */
    public function levelFor(EvaluationFormVersion $version, EvaluationCriterion $criterion, string|int|float|null $score): ?array
    {
        return $this->levelFrom($this->levels($version), $criterion, $score);
    }

    /**
     * The highest level whose starting percentage the score reaches. Exact decimal comparison.
     *
     * @param  list<array<string, mixed>>  $levels  Highest level first.
     * @return array{name: string, name_km: ?string, color: string}|null
     */
    public function levelFrom(array $levels, EvaluationCriterion $criterion, string|int|float|null $score): ?array
    {
        if ($levels === [] || $score === null) {
            return null;
        }

        try {
            $percent = $this->scoring->normalize($score, (string) $criterion->min_score, (string) $criterion->max_score);
        } catch (InvalidArgumentException) {
            return null;
        }

        foreach ($levels as $level) {
            if (bccomp($percent, $level['min_percent'], ScoringService::SCALE) >= 0) {
                return ['name' => $level['name'], 'name_km' => $level['name_km'], 'color' => $level['color']];
            }
        }

        return null;
    }

    /**
     * @param  list<array<string, mixed>>  $levels
     * @return list<array<string, mixed>>
     */
    private function clean(EvaluationFormVersion $version, array $levels): array
    {
        if ($levels === []) {
            return [];
        }

        if (count($levels) < self::MIN_LEVELS || count($levels) > self::MAX_LEVELS) {
            throw ValidationException::withMessages(['levels' => [__('A rubric needs between 2 and 8 levels.')]]);
        }

        $criteria = $version->criteria()->pluck('id')->map(fn ($id) => (int) $id)->all();
        $seen = [];
        $out = [];

        foreach ($levels as $level) {
            $min = bcadd((string) $level['min_percent'], '0', 2);
            if (isset($seen[$min])) {
                throw ValidationException::withMessages(['levels' => [__('Each level needs a different starting percentage.')]]);
            }
            $seen[$min] = true;

            $descriptions = [];
            foreach (($level['descriptions'] ?? []) as $criterionId => $text) {
                $text = trim((string) $text);
                if ($text !== '' && in_array((int) $criterionId, $criteria, true)) {
                    $descriptions[(int) $criterionId] = $text;
                }
            }

            $nameKm = isset($level['name_km']) ? trim((string) $level['name_km']) : '';

            $out[] = [
                'name' => trim((string) $level['name']),
                'name_km' => $nameKm !== '' ? $nameKm : null,
                'min_percent' => $min,
                'color' => (string) $level['color'],
                'descriptions' => $descriptions,
            ];
        }

        if (! isset($seen['0.00'])) {
            throw ValidationException::withMessages(['levels' => [__('One level must start at 0%.')]]);
        }

        usort($out, fn (array $a, array $b) => bccomp($b['min_percent'], $a['min_percent'], 2));

        return $out;
    }
}