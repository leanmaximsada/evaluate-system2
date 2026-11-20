<?php

namespace Tests\Feature\Forms;

use App\Models\User;
use App\Services\EvaluationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesForms;
use Tests\Concerns\CreatesScoringFixtures;
use Tests\TestCase;

class RubricTest extends TestCase
{
    use RefreshDatabase, CreatesForms, CreatesScoringFixtures;

    private function actor(User $user): static
    {
        return $this->spa()->actingAs($user, 'sanctum');
    }

    /** @return list<array<string, mixed>> */
    private function levels(array $firstDescriptions = []): array
    {
        return [
            ['name' => 'Needs Improvement', 'name_km' => null, 'min_percent' => '0', 'color' => 'red', 'descriptions' => []],
            ['name' => 'Superior', 'name_km' => 'ឆ្នើមបំផុត', 'min_percent' => '90', 'color' => 'green', 'descriptions' => $firstDescriptions],
            ['name' => 'Good', 'name_km' => null, 'min_percent' => '50', 'color' => 'amber', 'descriptions' => []],
            ['name' => 'Excellent', 'name_km' => null, 'min_percent' => '75', 'color' => 'blue', 'descriptions' => []],
        ];
    }

    /** @return array{0: User, 1: int, 2: int, 3: list<int>} admin, form id, draft version id, criterion ids */
    private function draft(?User $admin = null): array
    {
        $admin ??= User::factory()->admin()->create();

        $form = $this->actor($admin)->postJson('/api/v1/evaluation-forms', ['name' => 'Rubric form', 'is_weighted' => true])
            ->assertSuccessful()->json('data.id');
        $version = $this->actor($admin)->getJson("/api/v1/evaluation-forms/{$form}")->json('data.versions.0.id');

        $ids = [];
        foreach ([['Content', 60], ['Delivery', 40]] as [$name, $weight]) {
            $ids[] = $this->actor($admin)->postJson("/api/v1/evaluation-forms/{$form}/versions/{$version}/criteria", [
                'name' => $name, 'min_score' => 0, 'max_score' => 100, 'weight' => $weight, 'is_required' => true, 'is_active' => true,
            ])->assertSuccessful()->json('data.id');
        }

        return [$admin, $form, $version, $ids];
    }

    private function url(int $form, int $version): string
    {
        return "/api/v1/evaluation-forms/{$form}/versions/{$version}/rubric";
    }

    public function test_permissions(): void
    {
        [$admin, $form, $version] = $this->draft();
        $judge = User::factory()->judge()->create();

        $this->app['auth']->forgetGuards();
        $this->getJson($this->url($form, $version))->assertUnauthorized();
        $this->actor($judge)->getJson($this->url($form, $version))->assertForbidden();
        $this->actor($judge)->putJson($this->url($form, $version), ['levels' => []])->assertForbidden();
        $this->actor($admin)->getJson($this->url($form, $version))->assertOk()->assertJsonPath('data.levels', []);
    }

    public function test_levels_are_saved_sorted_and_descriptions_are_kept_only_for_real_criteria(): void
    {
        [$admin, $form, $version, $ids] = $this->draft();
        $url = $this->url($form, $version);

        $response = $this->actor($admin)->putJson($url, ['levels' => $this->levels([$ids[0] => 'Great work', 999999 => 'ghost'])])
            ->assertOk()
            ->assertJsonPath('data.levels.0.name', 'Superior')
            ->assertJsonPath('data.levels.0.name_km', 'ឆ្នើមបំផុត')
            ->assertJsonPath('data.levels.0.min_percent', '90.00')
            ->assertJsonPath('data.levels.1.name', 'Excellent')
            ->assertJsonPath('data.levels.3.name', 'Needs Improvement')
            ->assertJsonPath("data.levels.0.descriptions.{$ids[0]}", 'Great work')
            ->assertJsonMissingPath('data.levels.0.descriptions.999999');

        $this->assertSame(4, count($response->json('data.levels')));
        $this->actor($admin)->getJson($url)->assertJsonPath('data.levels.0.name', 'Superior');
        $this->assertDatabaseHas('audit_logs', ['action' => 'form.rubric_updated', 'user_id' => $admin->id]);
    }

    public function test_levels_are_validated(): void
    {
        [$admin, $form, $version] = $this->draft();
        $url = $this->url($form, $version);
        $base = $this->levels();

        $this->actor($admin)->putJson($url, [])->assertUnprocessable()->assertJsonValidationErrors('levels');
        $this->actor($admin)->putJson($url, ['levels' => [$base[0]]])->assertUnprocessable()->assertJsonValidationErrors('levels');

        $duplicate = $base;
        $duplicate[1]['min_percent'] = '50';
        $this->actor($admin)->putJson($url, ['levels' => $duplicate])->assertUnprocessable()->assertJsonValidationErrors('levels');

        $this->actor($admin)->putJson($url, ['levels' => array_slice($base, 1)])->assertUnprocessable()->assertJsonValidationErrors('levels');

        $many = [];
        for ($i = 0; $i < 9; $i++) {
            $many[] = ['name' => "L{$i}", 'name_km' => null, 'min_percent' => (string) ($i * 10), 'color' => 'slate', 'descriptions' => []];
        }
        $this->actor($admin)->putJson($url, ['levels' => $many])->assertUnprocessable()->assertJsonValidationErrors('levels');

        foreach ([['color', 'pink', 'levels.0.color'], ['name', '', 'levels.0.name'], ['min_percent', '101', 'levels.0.min_percent'], ['min_percent', 'abc', 'levels.0.min_percent']] as [$field, $value, $key]) {
            $bad = $base;
            $bad[0][$field] = $value;
            $this->actor($admin)->putJson($url, ['levels' => $bad])->assertUnprocessable()->assertJsonValidationErrors($key);
        }

        $this->actor($admin)->getJson($url)->assertJsonPath('data.levels', []);
    }

    public function test_the_rubric_can_be_removed(): void
    {
        [$admin, $form, $version] = $this->draft();
        $url = $this->url($form, $version);

        $this->actor($admin)->putJson($url, ['levels' => $this->levels()])->assertOk();
        $this->actor($admin)->putJson($url, ['levels' => []])->assertOk()->assertJsonPath('data.levels', []);
        $this->actor($admin)->getJson($url)->assertJsonPath('data.levels', []);
    }

    public function test_a_published_version_cannot_be_changed(): void
    {
        [$admin, $form, $version] = $this->draft();
        $url = $this->url($form, $version);

        $this->actor($admin)->putJson($url, ['levels' => $this->levels()])->assertOk();
        $this->actor($admin)->postJson("/api/v1/evaluation-forms/{$form}/versions/{$version}/publish")->assertSuccessful();

        $this->actor($admin)->putJson($url, ['levels' => []])->assertUnprocessable()->assertJsonValidationErrors('version');
        $this->actor($admin)->getJson($url)->assertJsonPath('data.levels.0.name', 'Superior');
    }

    public function test_a_version_is_only_reachable_through_its_own_form(): void
    {
        [$admin, $form, $version] = $this->draft();
        [, $otherForm] = $this->draft($admin);

        $this->actor($admin)->getJson($this->url($otherForm, $version))->assertNotFound();
        $this->actor($admin)->putJson($this->url($otherForm, $version), ['levels' => $this->levels()])->assertNotFound();
        $this->actor($admin)->getJson($this->url($form, $version))->assertOk()->assertJsonPath('data.levels', []);
    }

    public function test_a_new_version_copies_the_rubric_and_remaps_the_descriptions(): void
    {
        [$admin, $form, $version, $ids] = $this->draft();

        $this->actor($admin)->putJson($this->url($form, $version), ['levels' => $this->levels([$ids[0] => 'Great work'])])->assertOk();
        $this->actor($admin)->postJson("/api/v1/evaluation-forms/{$form}/versions/{$version}/publish")->assertSuccessful();

        $new = $this->actor($admin)->postJson("/api/v1/evaluation-forms/{$form}/versions")->assertSuccessful()->json('data.id');
        $newCriteria = $this->actor($admin)->getJson("/api/v1/evaluation-forms/{$form}/versions/{$new}")->json('data.criteria.*.id');

        $this->assertNotContains($ids[0], $newCriteria);

        $this->actor($admin)->getJson($this->url($form, $new))
            ->assertOk()
            ->assertJsonPath('data.levels.0.name', 'Superior')
            ->assertJsonPath("data.levels.0.descriptions.{$newCriteria[0]}", 'Great work')
            ->assertJsonMissingPath("data.levels.0.descriptions.{$ids[0]}");
    }

    public function test_judges_see_the_rubric_and_forms_without_one_show_null(): void
    {
        [$event, $version, , $judges] = $this->scoringEvent(1, 1, [100]);
        $criterion = $version->criteria()->firstOrFail();
        $url = "/api/v1/judge/events/{$event->id}";

        $this->actor($judges[0])->getJson($url)->assertOk()->assertJsonPath('data.rubric', null);

        $version->rubric = ['levels' => [
            ['name' => 'Superior', 'name_km' => null, 'min_percent' => '90.00', 'color' => 'green', 'descriptions' => [$criterion->id => 'Outstanding']],
            ['name' => 'Fair', 'name_km' => null, 'min_percent' => '0.00', 'color' => 'amber', 'descriptions' => []],
        ]];
        $version->save();

        $this->actor($judges[0])->getJson($url)
            ->assertJsonPath('data.rubric.0.name', 'Superior')
            ->assertJsonPath("data.rubric.0.descriptions.{$criterion->id}", 'Outstanding')
            ->assertJsonPath('data.rubric.1.name', 'Fair');
    }

    public function test_the_results_detail_labels_each_score_with_its_level(): void
    {
        [$event, $version, $people, $judges, $admin] = $this->scoringEvent(1, 1, [100]);
        $version->rubric = ['levels' => [
            ['name' => 'Superior', 'name_km' => null, 'min_percent' => '90.00', 'color' => 'green', 'descriptions' => []],
            ['name' => 'Fair', 'name_km' => null, 'min_percent' => '0.00', 'color' => 'amber', 'descriptions' => []],
        ]];
        $version->save();

        app(EvaluationService::class)->submit($event, $people[0], $judges[0], $this->scoreMap($version, [92]), $judges[0]);

        $this->actor($admin)->getJson("/api/v1/events/{$event->id}/results/{$people[0]->id}")
            ->assertOk()
            ->assertJsonPath('data.judges.0.scores.0.level.name', 'Superior')
            ->assertJsonPath('data.judges.0.scores.0.level.color', 'green');
    }
}