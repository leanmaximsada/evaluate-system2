<?php

namespace App\Services;

use App\Enums\FormStatus;
use App\Models\EvaluationCriterion;
use App\Models\EvaluationForm;
use App\Models\EvaluationFormVersion;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class EvaluationFormService
{
    private const CRITERION_FIELDS = ['name', 'description', 'min_score', 'max_score', 'weight', 'is_required', 'is_active'];

    public function __construct(private readonly AuditLogger $audit) {}

    /** @param array<string, mixed> $data */
    public function create(array $data, User $actor): EvaluationForm
    {
        return DB::transaction(function () use ($data, $actor) {
            $form = new EvaluationForm(Arr::only($data, ['name', 'description']));
            $form->status = FormStatus::Draft;
            $form->created_by = $actor->id;
            $form->save();

            $version = new EvaluationFormVersion(['is_weighted' => $data['is_weighted'] ?? true]);
            $version->evaluation_form_id = $form->id;
            $version->version_number = 1;
            $version->status = 'draft';
            $version->created_by = $actor->id;
            $version->save();

            $this->audit->log('form.created', $form, ['name' => $form->name], $actor);

            return $form;
        });
    }

    /** @param array<string, mixed> $data */
    public function updateDetails(EvaluationForm $form, array $data, User $actor): EvaluationForm
    {
        $form->fill(Arr::only($data, ['name', 'description']));
        $changed = array_keys($form->getDirty());
        $form->save();

        if ($changed !== []) {
            $this->audit->log('form.updated', $form, ['fields' => $changed], $actor);
        }

        return $form;
    }

    public function setStatus(EvaluationForm $form, FormStatus $to, User $actor): EvaluationForm
    {
        return DB::transaction(function () use ($form, $to, $actor) {
            if ($to === FormStatus::Draft) {
                throw ValidationException::withMessages(['status' => [__('A form cannot be moved back to draft.')]]);
            }
            if ($to === FormStatus::Active && ! $form->versions()->where('status', 'published')->exists()) {
                throw ValidationException::withMessages(['status' => [__('Publish a version before activating the form.')]]);
            }

            $from = $form->status;
            $form->status = $to;
            $form->save();

            if ($from !== $to) {
                $this->audit->log('form.status_changed', $form, ['from' => $from->value, 'to' => $to->value], $actor);
            }

            return $form;
        });
    }

    public function createVersion(EvaluationForm $form, User $actor): EvaluationFormVersion
    {
        return DB::transaction(function () use ($form, $actor) {
            EvaluationForm::query()->whereKey($form->id)->lockForUpdate()->firstOrFail();

            $versions = EvaluationFormVersion::where('evaluation_form_id', $form->id)->get();
            if ($versions->contains('status', 'draft')) {
                throw ValidationException::withMessages(['version' => [__('A draft version already exists. Finish or publish it first.')]]);
            }

            $source = $versions->where('status', 'published')->sortByDesc('version_number')->first();
            if (! $source) {
                throw ValidationException::withMessages(['version' => [__('Publish a version first, then a new version can be created from it.')]]);
            }

            $new = new EvaluationFormVersion(['is_weighted' => $source->is_weighted]);
            $new->evaluation_form_id = $form->id;
            $new->version_number = (int) $versions->max('version_number') + 1;
            $new->status = 'draft';
            $new->created_by = $actor->id;
            $new->save();

            foreach ($source->criteria as $criterion) {
                $copy = $criterion->replicate();
                $copy->evaluation_form_version_id = $new->id;
                $copy->save();
            }

            $this->audit->log('form.version_created', $form, ['version' => $new->version_number, 'from' => $source->version_number], $actor);

            return $new;
        });
    }

    /** @param array<string, mixed> $data */
    public function updateVersion(EvaluationFormVersion $version, array $data, User $actor): EvaluationFormVersion
    {
        return DB::transaction(function () use ($version, $data, $actor) {
            $version = $this->lockDraft($version);
            $version->is_weighted = (bool) $data['is_weighted'];
            $version->save();

            $this->audit->log('form.version_updated', $version->form, ['version' => $version->version_number, 'is_weighted' => $version->is_weighted], $actor);

            return $version;
        });
    }

    public function publish(EvaluationFormVersion $version, User $actor): EvaluationFormVersion
    {
        return DB::transaction(function () use ($version, $actor) {
            $version = $this->lockVersion($version);

            if ($version->status !== 'draft') {
                throw ValidationException::withMessages(['version' => [__('Only a draft version can be published.')]]);
            }

            $issues = $this->publishIssues($version);
            if ($issues !== []) {
                throw ValidationException::withMessages([
                    'version' => array_map(fn (string $code) => $this->issueMessage($code), $issues),
                ]);
            }

            $version->status = 'published';
            $version->published_at = Carbon::now();
            $version->save();

            $form = EvaluationForm::query()->whereKey($version->evaluation_form_id)->lockForUpdate()->firstOrFail();
            if ($form->status === FormStatus::Draft) {
                $form->status = FormStatus::Active;
                $form->save();
            }

            $this->audit->log('form.version_published', $form, ['version' => $version->version_number], $actor);

            return $version;
        });
    }

    /** @return list<string> Codes explaining why a version cannot be published yet. */
    public function publishIssues(EvaluationFormVersion $version): array
    {
        $active = $version->criteria()->where('is_active', true)->get(['weight']);

        if ($active->isEmpty()) {
            return ['no_active_criteria'];
        }

        if ($version->is_weighted) {
            // Weights have 2 decimals, so compare in whole hundredths to avoid float drift.
            $hundredths = $active->sum(fn ($c) => (int) round(((float) $c->weight) * 100));
            if ($hundredths !== 10000) {
                return ['weights_not_100'];
            }
        }

        return [];
    }

    /** @param array<string, mixed> $data */
    public function addCriterion(EvaluationFormVersion $version, array $data, User $actor): EvaluationCriterion
    {
        return DB::transaction(function () use ($version, $data, $actor) {
            $version = $this->lockDraft($version);

            $criterion = new EvaluationCriterion(Arr::only($data, self::CRITERION_FIELDS));
            $criterion->is_required = $data['is_required'] ?? true;
            $criterion->is_active = $data['is_active'] ?? true;
            $criterion->weight = $data['weight'] ?? 0;
            $criterion->evaluation_form_version_id = $version->id;
            $criterion->display_order = (int) EvaluationCriterion::where('evaluation_form_version_id', $version->id)->max('display_order') + 1;
            $criterion->save();

            $this->audit->log('form.criterion_added', $version->form, ['version' => $version->version_number, 'criterion' => $criterion->name], $actor);

            return $criterion;
        });
    }

    /** @param array<string, mixed> $data */
    public function updateCriterion(EvaluationFormVersion $version, EvaluationCriterion $criterion, array $data, User $actor): EvaluationCriterion
    {
        return DB::transaction(function () use ($version, $criterion, $data, $actor) {
            $version = $this->lockDraft($version);

            $criterion->fill(Arr::only($data, self::CRITERION_FIELDS));
            $changed = array_keys($criterion->getDirty());
            $criterion->save();

            if ($changed !== []) {
                $this->audit->log('form.criterion_updated', $version->form, ['version' => $version->version_number, 'criterion' => $criterion->name, 'fields' => $changed], $actor);
            }

            return $criterion;
        });
    }

    public function deleteCriterion(EvaluationFormVersion $version, EvaluationCriterion $criterion, User $actor): void
    {
        DB::transaction(function () use ($version, $criterion, $actor) {
            $version = $this->lockDraft($version);
            $name = $criterion->name;
            $criterion->delete();

            $ids = EvaluationCriterion::where('evaluation_form_version_id', $version->id)->orderBy('display_order')->pluck('id');
            foreach ($ids as $index => $id) {
                EvaluationCriterion::where('id', $id)->update(['display_order' => $index + 1]);
            }

            $this->audit->log('form.criterion_deleted', $version->form, ['version' => $version->version_number, 'criterion' => $name], $actor);
        });
    }

    /** @param list<int> $ids */
    public function reorderCriteria(EvaluationFormVersion $version, array $ids, User $actor): void
    {
        DB::transaction(function () use ($version, $ids, $actor) {
            $version = $this->lockDraft($version);

            $existing = EvaluationCriterion::where('evaluation_form_version_id', $version->id)->pluck('id')->all();
            $given = array_map('intval', $ids);
            $sorted = $given;
            sort($existing);
            sort($sorted);

            if ($existing !== $sorted) {
                throw ValidationException::withMessages(['order' => [__('The order must list every criterion exactly once.')]]);
            }

            foreach ($given as $index => $id) {
                EvaluationCriterion::where('id', $id)->update(['display_order' => $index + 1]);
            }

            $this->audit->log('form.criteria_reordered', $version->form, ['version' => $version->version_number], $actor);
        });
    }

    private function lockVersion(EvaluationFormVersion $version): EvaluationFormVersion
    {
        return EvaluationFormVersion::query()->whereKey($version->id)->lockForUpdate()->firstOrFail();
    }

    private function lockDraft(EvaluationFormVersion $version): EvaluationFormVersion
    {
        $locked = $this->lockVersion($version);

        if ($locked->status !== 'draft') {
            throw ValidationException::withMessages(['version' => [__('Published versions cannot be changed. Create a new version instead.')]]);
        }

        return $locked;
    }

    private function issueMessage(string $code): string
    {
        return match ($code) {
            'no_active_criteria' => __('Add at least one active criterion before publishing.'),
            'weights_not_100' => __('Active criterion weights must total 100% before publishing.'),
            default => $code,
        };
    }
}