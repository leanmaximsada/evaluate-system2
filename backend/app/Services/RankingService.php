<?php

namespace App\Services;

/** Pure ranking logic. Scores are compared as two-decimal strings, never as floats. */
class RankingService
{
    /**
     * @param  list<array{id: int, score: ?string, order?: int}>  $entries
     * @return list<array{id: int, rank: ?int, tied: bool}>  Best first; unscored entries last with a null rank.
     */
    public function rank(array $entries, string $tiePolicy = 'standard'): array
    {
        $scored = array_values(array_filter($entries, fn (array $e) => $e['score'] !== null));
        $unscored = array_values(array_filter($entries, fn (array $e) => $e['score'] === null));

        $byOrder = fn (array $a, array $b): int => (($a['order'] ?? 0) <=> ($b['order'] ?? 0)) ?: ($a['id'] <=> $b['id']);

        // Highest score first. Presentation order, then id, make the sequence deterministic.
        usort($scored, fn (array $a, array $b) => bccomp($b['score'], $a['score'], 2) ?: $byOrder($a, $b));
        usort($unscored, $byOrder);

        $result = [];
        $count = count($scored);
        $group = 0;
        $i = 0;

        while ($i < $count) {
            $j = $i;
            while ($j + 1 < $count && bccomp($scored[$j + 1]['score'], $scored[$i]['score'], 2) === 0) {
                $j++;
            }

            $group++;
            $rank = $tiePolicy === 'dense' ? $group : $i + 1;
            $tied = ($j - $i) > 0;

            for ($k = $i; $k <= $j; $k++) {
                $result[] = ['id' => $scored[$k]['id'], 'rank' => $rank, 'tied' => $tied];
            }

            $i = $j + 1;
        }

        foreach ($unscored as $entry) {
            $result[] = ['id' => $entry['id'], 'rank' => null, 'tied' => false];
        }

        return $result;
    }
}