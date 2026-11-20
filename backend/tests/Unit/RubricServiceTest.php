<?php

namespace Tests\Unit;

use App\Models\EvaluationCriterion;
use App\Services\RubricService;
use Tests\TestCase;

class RubricServiceTest extends TestCase
{
    private function levels(): array
    {
        return [
            ['name' => 'Superior', 'name_km' => null, 'min_percent' => '90.00', 'color' => 'green', 'descriptions' => []],
            ['name' => 'Excellent', 'name_km' => null, 'min_percent' => '75.00', 'color' => 'blue', 'descriptions' => []],
            ['name' => 'Good', 'name_km' => null, 'min_percent' => '50.00', 'color' => 'amber', 'descriptions' => []],
            ['name' => 'Needs Improvement', 'name_km' => null, 'min_percent' => '0.00', 'color' => 'red', 'descriptions' => []],
        ];
    }

    private function criterion(string $min, string $max): EvaluationCriterion
    {
        return (new EvaluationCriterion())->forceFill(['id' => 1, 'min_score' => $min, 'max_score' => $max]);
    }

    // Not called name(): PHPUnit already has a final method with that name.
    private function levelNameFor(string $min, string $max, string|int|float|null $score): ?string
    {
        return app(RubricService::class)->levelFrom($this->levels(), $this->criterion($min, $max), $score)['name'] ?? null;
    }

    public function test_a_score_falls_in_the_highest_level_it_reaches(): void
    {
        $this->assertSame('Superior', $this->levelNameFor('0', '100', '100'));
        $this->assertSame('Superior', $this->levelNameFor('0', '100', '90'));
        $this->assertSame('Excellent', $this->levelNameFor('0', '100', '89.99'));
        $this->assertSame('Excellent', $this->levelNameFor('0', '100', '75'));
        $this->assertSame('Good', $this->levelNameFor('0', '100', '74.99'));
        $this->assertSame('Good', $this->levelNameFor('0', '100', '50'));
        $this->assertSame('Needs Improvement', $this->levelNameFor('0', '100', '49.99'));
        $this->assertSame('Needs Improvement', $this->levelNameFor('0', '100', '0'));
    }

    public function test_it_works_for_any_score_range(): void
    {
        $this->assertSame('Superior', $this->levelNameFor('0', '10', '9'));
        $this->assertSame('Excellent', $this->levelNameFor('0', '10', '7.5'));
        $this->assertSame('Good', $this->levelNameFor('1', '5', '3'));
        $this->assertSame('Superior', $this->levelNameFor('1', '5', '5'));
    }

    public function test_no_rubric_or_no_score_gives_no_level(): void
    {
        $service = app(RubricService::class);

        $this->assertNull($service->levelFrom([], $this->criterion('0', '100'), '80'));
        $this->assertNull($service->levelFrom($this->levels(), $this->criterion('0', '100'), null));
    }
}