<?php

namespace Tests\Concerns;

use App\Models\EvaluationFormVersion;
use App\Models\User;
use App\Services\EvaluationFormService;
use Illuminate\Support\Str;

trait CreatesForms
{
    /** Creates a form with one criterion per given weight and publishes version 1. */
    protected function publishedVersion(User $creator, array $weights = [60, 40], bool $weighted = true): EvaluationFormVersion
    {
        $service = app(EvaluationFormService::class);
        $form = $service->create(['name' => 'Form '.Str::random(6), 'description' => null, 'is_weighted' => $weighted], $creator);
        $version = $form->versions()->firstOrFail();

        foreach ($weights as $i => $weight) {
            $service->addCriterion($version, ['name' => 'Criterion '.($i + 1), 'min_score' => 0, 'max_score' => 100, 'weight' => $weight], $creator);
        }

        $service->publish($version, $creator);

        return $version->fresh();
    }
}