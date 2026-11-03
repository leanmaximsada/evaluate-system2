# Scoring and ranking

All arithmetic uses exact decimals (PHP bcmath, 10 decimal places). Floats are never used for scores.

## One judge's total

For each scored, active criterion:

    normalized = (score - min) / (max - min) * 100

    total = sum(weight * normalized) / sum(weight)

- Weighted form: `weight` is the criterion's percentage. When every criterion is scored and the weights total 100, this equals `sum(score * weight / 100)`.
- Unweighted form: every criterion has weight 1, so the total is the mean of the normalized scores.
- A criterion that was not scored (optional, left blank) is left out and the remaining weights are rescaled. It is never counted as zero.

Worked example (all criteria 0-100): 80 x 30% + 90 x 25% + 85 x 25% + 95 x 20% = 24 + 22.5 + 21.25 + 19 = 86.75.

## Several judges

The aggregate is the arithmetic mean of the totals of judges who submitted, rounded half up to the event's score precision (0 to 2 decimals). Judges who have not submitted are excluded. A participant is "complete" when every assigned judge has submitted.

## Ranking

Participants are ranked by the rounded aggregate, highest first. Tied participants share a rank:

- standard: 1, 2, 2, 4
- dense: 1, 2, 2, 3

Withdrawn and disqualified participants, and participants with no submitted evaluation, are not ranked.

## Policy

When an event starts, the scoring defaults from Settings are copied into the event (`events.scoring_policy`). Later changes to Settings do not affect a started event.

## Corrections

An administrator can correct a submitted evaluation with a mandatory reason. The previous scores and total are kept in `evaluation_score_revisions`, and results are recalculated in the same transaction.  