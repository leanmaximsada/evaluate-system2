<?php

namespace Tests\Unit;

use App\Models\EvaluationCriterion;
use App\Services\ScoringService;
use Tests\TestCase;

class ScoringServiceTest extends TestCase
{
    private ScoringService $scoring;

    protected function setUp(): void
    {
        parent::setUp();
        $this->scoring = new ScoringService();
    }

    private function criterion(int $id, string $min, string $max, string $weight, bool $active = true): EvaluationCriterion
    {
        return (new EvaluationCriterion())->forceFill([
            'id' => $id, 'min_score' => $min, 'max_score' => $max, 'weight' => $weight, 'is_active' => $active,
        ]);
    }

    public function test_the_specification_example_gives_86_75(): void
    {
        $criteria = [
            $this->criterion(1, '0', '100', '30'), $this->criterion(2, '0', '100', '25'),
            $this->criterion(3, '0', '100', '25'), $this->criterion(4, '0', '100', '20'),
        ];

        $total = $this->scoring->judgeTotal(true, $criteria, [1 => '80', 2 => '90', 3 => '85', 4 => '95']);

        $this->assertSame('86.75', $this->scoring->round($total, 2));
    }

    public function test_different_score_ranges_are_normalized_before_weighting(): void
    {
        $criteria = [$this->criterion(1, '0', '10', '50'), $this->criterion(2, '0', '100', '50')];

        $total = $this->scoring->judgeTotal(true, $criteria, [1 => '8', 2 => '80']);

        $this->assertSame('80.00', $this->scoring->round($total, 2));
    }

    public function test_a_non_zero_minimum_is_respected(): void
    {
        $this->assertSame('50.0000000000', $this->scoring->normalize('3', '1', '5'));
    }

    public function test_unweighted_forms_count_every_criterion_equally(): void
    {
        $criteria = [$this->criterion(1, '0', '100', '0'), $this->criterion(2, '0', '100', '0')];

        $total = $this->scoring->judgeTotal(false, $criteria, [1 => '100', 2 => '50']);

        $this->assertSame('75.00', $this->scoring->round($total, 2));
    }

    public function test_a_missing_criterion_is_left_out_not_counted_as_zero(): void
    {
        $criteria = [$this->criterion(1, '0', '100', '60'), $this->criterion(2, '0', '100', '40')];

        $total = $this->scoring->judgeTotal(true, $criteria, [1 => '50']);

        $this->assertSame('50.00', $this->scoring->round($total, 2));
    }

    public function test_inactive_criteria_are_ignored(): void
    {
        $criteria = [$this->criterion(1, '0', '100', '100'), $this->criterion(2, '0', '100', '50', false)];

        $total = $this->scoring->judgeTotal(true, $criteria, [1 => '70', 2 => '10']);

        $this->assertSame('70.00', $this->scoring->round($total, 2));
    }

    public function test_decimal_weights_are_exact(): void
    {
        $criteria = [
            $this->criterion(1, '0', '100', '33.33'), $this->criterion(2, '0', '100', '33.33'), $this->criterion(3, '0', '100', '33.34'),
        ];

        $total = $this->scoring->judgeTotal(true, $criteria, [1 => '100', 2 => '100', 3 => '100']);

        $this->assertSame('100.00', $this->scoring->round($total, 2));
    }

    public function test_nothing_scored_gives_null(): void
    {
        $this->assertNull($this->scoring->judgeTotal(true, [$this->criterion(1, '0', '100', '100')], []));
    }

    public function test_rounding_is_half_up(): void
    {
        $this->assertSame('86.75', $this->scoring->round('86.745', 2));
        $this->assertSame('86.74', $this->scoring->round('86.7449999999', 2));
        $this->assertSame('87', $this->scoring->round('86.5', 0));
        $this->assertSame('86.6', $this->scoring->round('86.55', 1));
        $this->assertSame('0.00', $this->scoring->round('0.004', 2));
    }

    public function test_mean_of_judge_totals(): void
    {
        $this->assertSame('85.00', $this->scoring->round((string) $this->scoring->mean(['80', '90', '85']), 2));
        $this->assertSame('86.50', $this->scoring->round((string) $this->scoring->mean(['86.00', '87.00']), 2));
        $this->assertNull($this->scoring->mean([]));
    }

    public function test_decimal_helper_pads_to_two_places(): void
    {
        $this->assertSame('87.00', $this->scoring->decimal('87'));
        $this->assertSame('86.50', $this->scoring->decimal('86.5'));
    }
}