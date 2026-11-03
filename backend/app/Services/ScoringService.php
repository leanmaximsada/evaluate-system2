<?php

namespace App\Services;

use App\Models\EvaluationCriterion;
use InvalidArgumentException;
use RuntimeException;

/**
 * Pure score arithmetic on exact decimals (bcmath). No database access.
 *
 *   normalized = (score - min) / (max - min) * 100
 *   total      = sum(weight * normalized) / sum(weight)   over the criteria that were scored
 *
 * For a complete form whose weights total 100 this equals sum(score * weight / 100).
 * An unweighted form gives every criterion weight 1.
 */
class ScoringService
{
    public const SCALE = 10;

    public function __construct()
    {
        if (! function_exists('bcadd')) {
            throw new RuntimeException('The bcmath PHP extension is required for score calculation.');
        }
    }

    /**
     * One judge's total on a 0-100 scale, unrounded (10 decimals). Null when nothing was scored.
     *
     * @param  iterable<EvaluationCriterion>  $criteria
     * @param  array<int, string|int|float>  $scores  criterion id => score
     */
    public function judgeTotal(bool $weighted, iterable $criteria, array $scores): ?string
    {
        $sum = '0';
        $weights = '0';

        foreach ($criteria as $criterion) {
            if (! $criterion->is_active || ! array_key_exists($criterion->id, $scores)) {
                continue;
            }

            $weight = $weighted ? (string) $criterion->weight : '1';
            $normalized = $this->normalize($scores[$criterion->id], (string) $criterion->min_score, (string) $criterion->max_score);

            $sum = bcadd($sum, bcmul($weight, $normalized, self::SCALE), self::SCALE);
            $weights = bcadd($weights, $weight, self::SCALE);
        }

        if (bccomp($weights, '0', self::SCALE) === 0) {
            return null;
        }

        return bcdiv($sum, $weights, self::SCALE);
    }

    public function normalize(string|int|float $score, string $min, string $max): string
    {
        $range = bcsub($max, $min, self::SCALE);
        if (bccomp($range, '0', self::SCALE) <= 0) {
            throw new InvalidArgumentException('A criterion needs a maximum above its minimum.');
        }

        $offset = bcsub($this->text($score), $min, self::SCALE);

        return bcdiv(bcmul($offset, '100', self::SCALE), $range, self::SCALE);
    }

    /** @param list<string> $totals */
    public function mean(array $totals): ?string
    {
        if ($totals === []) {
            return null;
        }

        $sum = '0';
        foreach ($totals as $total) {
            $sum = bcadd($sum, $total, self::SCALE);
        }

        return bcdiv($sum, (string) count($totals), self::SCALE);
    }

    /** Round half up (scores are never negative). */
    public function round(string $value, int $decimals): string
    {
        return bcadd($value, '0.'.str_repeat('0', $decimals).'5', $decimals);
    }

    /** Two-decimal string for storage in decimal(8,2) columns. */
    public function decimal(string $value): string
    {
        return bcadd($value, '0', 2);
    }

    private function text(string|int|float $value): string
    {
        return is_string($value) ? $value : number_format((float) $value, 2, '.', '');
    }
}