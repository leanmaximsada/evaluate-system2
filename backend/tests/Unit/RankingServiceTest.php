<?php

namespace Tests\Unit;

use App\Services\RankingService;
use Tests\TestCase;

class RankingServiceTest extends TestCase
{
    private RankingService $ranking;

    protected function setUp(): void
    {
        parent::setUp();
        $this->ranking = new RankingService();
    }

    private function entries(array $scores): array
    {
        $out = [];
        foreach ($scores as $index => $score) {
            $out[] = ['id' => $index + 1, 'score' => $score, 'order' => $index + 1];
        }

        return $out;
    }

    private function ranks(array $result): array
    {
        return array_column($result, 'rank', 'id');
    }

    public function test_standard_competition_ranking_skips_after_a_tie(): void
    {
        $result = $this->ranking->rank($this->entries(['90.00', '85.00', '85.00', '70.00']), 'standard');

        $this->assertSame([1 => 1, 2 => 2, 3 => 2, 4 => 4], $this->ranks($result));
        $this->assertSame([false, true, true, false], array_column($result, 'tied'));
    }

    public function test_dense_ranking_does_not_skip(): void
    {
        $result = $this->ranking->rank($this->entries(['90.00', '85.00', '85.00', '70.00']), 'dense');

        $this->assertSame([1 => 1, 2 => 2, 3 => 2, 4 => 3], $this->ranks($result));
    }

    public function test_three_way_tie_and_a_tie_for_first(): void
    {
        $result = $this->ranking->rank($this->entries(['80.00', '80.00', '80.00', '60.00']), 'standard');

        $this->assertSame([1 => 1, 2 => 1, 3 => 1, 4 => 4], $this->ranks($result));
    }

    public function test_unscored_entries_have_no_rank_and_come_last(): void
    {
        $result = $this->ranking->rank($this->entries([null, '70.00', null]), 'standard');

        $this->assertSame([2, 1, 3], array_column($result, 'id'));
        $this->assertSame([2 => 1, 1 => null, 3 => null], $this->ranks($result));
        $this->assertFalse($result[1]['tied']);
    }

    public function test_scores_are_compared_numerically_not_as_text(): void
    {
        $result = $this->ranking->rank($this->entries(['9.50', '10.00', '85.5', '85.50']), 'standard');

        $this->assertSame([3 => 1, 4 => 1, 2 => 3, 1 => 4], $this->ranks($result));
    }

    public function test_the_result_does_not_depend_on_input_order(): void
    {
        $entries = $this->entries(['80.00', '90.00', '80.00', '70.00', null]);

        $forward = $this->ranking->rank($entries, 'standard');
        $reversed = $this->ranking->rank(array_reverse($entries), 'standard');

        $this->assertSame($forward, $reversed);
    }
}