<?php

namespace Tests\Feature\Forms;

use App\Enums\EventStatus;
use App\Models\Event;
use App\Models\EvaluationCriterion;
use App\Models\EvaluationFormVersion;
use App\Models\Participant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesForms;
use Tests\TestCase;

class EvaluationFormTest extends TestCase
{
    use RefreshDatabase, CreatesForms;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->admin()->create();
    }

    private function actor(?User $user = null): static
    {
        return $this->spa()->actingAs($user ?? $this->admin, 'sanctum');
    }

    private function createForm(array $overrides = []): int
    {
        return $this->actor()->postJson('/api/v1/evaluation-forms', array_merge(['name' => 'Judging form', 'is_weighted' => true], $overrides))
            ->assertCreated()->json('data.id');
    }

    private function versionId(int $formId, int $number = 1): int
    {
        return (int) EvaluationFormVersion::where('evaluation_form_id', $formId)->where('version_number', $number)->value('id');
    }

    private function addCriterion(int $form, int $version, array $overrides = [])
    {
        return $this->actor()->postJson("/api/v1/evaluation-forms/{$form}/versions/{$version}/criteria", array_merge([
            'name' => 'Content', 'min_score' => 0, 'max_score' => 100, 'weight' => 50,
        ], $overrides));
    }

    private function publish(int $form, int $version)
    {
        return $this->actor()->postJson("/api/v1/evaluation-forms/{$form}/versions/{$version}/publish");
    }

    public function test_requires_authentication_and_the_forms_permission(): void
    {
        $this->getJson('/api/v1/evaluation-forms')->assertUnauthorized();

        $judge = User::factory()->judge()->create();
        $this->actor($judge)->getJson('/api/v1/evaluation-forms')->assertForbidden();
        $this->actor($judge)->postJson('/api/v1/evaluation-forms', ['name' => 'X'])->assertForbidden();

        $this->actor()->getJson('/api/v1/evaluation-forms')->assertOk();
    }

    public function test_creating_a_form_creates_a_draft_first_version(): void
    {
        $this->actor()->postJson('/api/v1/evaluation-forms', ['name' => 'Speaking', 'description' => 'Rubric', 'is_weighted' => true])
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.versions.0.version_number', 1)
            ->assertJsonPath('data.versions.0.status', 'draft')
            ->assertJsonPath('data.versions.0.is_weighted', true);

        $this->assertDatabaseHas('audit_logs', ['action' => 'form.created', 'user_id' => $this->admin->id]);
    }

    public function test_create_validation(): void
    {
        $this->actor()->postJson('/api/v1/evaluation-forms', ['name' => ''])
            ->assertUnprocessable()->assertJsonValidationErrors('name');
    }

    public function test_criteria_get_automatic_order_and_are_validated(): void
    {
        $form = $this->createForm();
        $version = $this->versionId($form);

        $this->addCriterion($form, $version, ['name' => 'A'])->assertCreated()->assertJsonPath('data.display_order', 1);
        $this->addCriterion($form, $version, ['name' => 'B'])->assertCreated()->assertJsonPath('data.display_order', 2);

        $this->addCriterion($form, $version, ['min_score' => 10, 'max_score' => 10])->assertUnprocessable()->assertJsonValidationErrors('max_score');
        $this->addCriterion($form, $version, ['weight' => 101])->assertUnprocessable()->assertJsonValidationErrors('weight');
        $this->addCriterion($form, $version, ['min_score' => 0.123])->assertUnprocessable()->assertJsonValidationErrors('min_score');
        $this->addCriterion($form, $version, ['name' => ''])->assertUnprocessable()->assertJsonValidationErrors('name');
    }

    public function test_cannot_publish_without_active_criteria(): void
    {
        $form = $this->createForm();
        $version = $this->versionId($form);

        $this->publish($form, $version)->assertUnprocessable()->assertJsonValidationErrors('version');

        $this->addCriterion($form, $version, ['is_active' => false, 'weight' => 100])->assertCreated();
        $this->publish($form, $version)->assertUnprocessable()->assertJsonValidationErrors('version');
    }

    public function test_weighted_form_needs_weights_totalling_100(): void
    {
        $form = $this->createForm();
        $version = $this->versionId($form);

        $this->addCriterion($form, $version, ['name' => 'A', 'weight' => 60]);
        $this->addCriterion($form, $version, ['name' => 'B', 'weight' => 30]);

        $this->actor()->getJson("/api/v1/evaluation-forms/{$form}/versions/{$version}")
            ->assertJsonPath('data.weight_total', 90)->assertJsonPath('data.publish_issues.0', 'weights_not_100');
        $this->publish($form, $version)->assertUnprocessable();

        $this->addCriterion($form, $version, ['name' => 'C', 'weight' => 10]);
        $this->publish($form, $version)->assertOk()->assertJsonPath('data.status', 'published');

        $this->actor()->getJson("/api/v1/evaluation-forms/{$form}")->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.latest_published_version', 1);
    }

    public function test_decimal_weights_are_summed_exactly(): void
    {
        $form = $this->createForm();
        $version = $this->versionId($form);

        foreach ([33.33, 33.33, 33.34] as $i => $w) {
            $this->addCriterion($form, $version, ['name' => "C{$i}", 'weight' => $w])->assertCreated();
        }

        $this->publish($form, $version)->assertOk();
    }

    public function test_unweighted_form_publishes_without_weights(): void
    {
        $form = $this->createForm(['is_weighted' => false]);
        $version = $this->versionId($form);

        $this->addCriterion($form, $version, ['weight' => 0])->assertCreated();
        $this->publish($form, $version)->assertOk();
    }

    public function test_inactive_criteria_are_ignored_in_the_weight_total(): void
    {
        $form = $this->createForm();
        $version = $this->versionId($form);

        $this->addCriterion($form, $version, ['name' => 'Live', 'weight' => 100]);
        $this->addCriterion($form, $version, ['name' => 'Off', 'weight' => 50, 'is_active' => false]);

        $this->publish($form, $version)->assertOk();
    }

    public function test_published_version_is_immutable(): void
    {
        $version = $this->publishedVersion($this->admin);
        $form = $version->evaluation_form_id;
        $criterion = $version->criteria()->firstOrFail();
        $base = "/api/v1/evaluation-forms/{$form}/versions/{$version->id}";

        $this->addCriterion($form, $version->id)->assertUnprocessable()->assertJsonValidationErrors('version');
        $this->actor()->putJson("{$base}/criteria/{$criterion->id}", ['name' => 'Changed', 'min_score' => 0, 'max_score' => 10, 'weight' => 60])
            ->assertUnprocessable();
        $this->actor()->deleteJson("{$base}/criteria/{$criterion->id}")->assertUnprocessable();
        $this->actor()->putJson("{$base}/criteria/order", ['order' => $version->criteria()->pluck('id')->all()])->assertUnprocessable();
        $this->actor()->putJson($base, ['is_weighted' => false])->assertUnprocessable();
        $this->publish($form, $version->id)->assertUnprocessable();

        $this->assertNotSame('Changed', $criterion->fresh()->name);
        $this->assertSame(2, $version->criteria()->count());
    }

    public function test_new_version_copies_criteria_and_leaves_the_old_one_unchanged(): void
    {
        $v1 = $this->publishedVersion($this->admin);
        $form = $v1->evaluation_form_id;

        $response = $this->actor()->postJson("/api/v1/evaluation-forms/{$form}/versions")
            ->assertCreated()
            ->assertJsonPath('data.version_number', 2)
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonCount(2, 'data.criteria');
        $v2 = $response->json('data.id');

        $this->actor()->postJson("/api/v1/evaluation-forms/{$form}/versions")->assertUnprocessable();

        $copy = EvaluationCriterion::where('evaluation_form_version_id', $v2)->orderBy('display_order')->firstOrFail();
        $this->actor()->putJson("/api/v1/evaluation-forms/{$form}/versions/{$v2}/criteria/{$copy->id}", [
            'name' => 'Rewritten', 'min_score' => 0, 'max_score' => 10, 'weight' => 60,
        ])->assertOk();

        $original = EvaluationCriterion::where('evaluation_form_version_id', $v1->id)->orderBy('display_order')->firstOrFail();
        $this->assertSame('Criterion 1', $original->name);
        $this->assertSame('100.00', $original->max_score);

        $this->publish($form, $v2)->assertOk();
        $this->actor()->getJson("/api/v1/evaluation-forms/{$form}")->assertJsonPath('data.latest_published_version', 2);
    }

    public function test_a_brand_new_form_cannot_branch_a_version(): void
    {
        $form = $this->createForm();

        $this->actor()->postJson("/api/v1/evaluation-forms/{$form}/versions")->assertUnprocessable();
    }

    public function test_criteria_can_be_reordered_and_deleted_in_a_draft(): void
    {
        $form = $this->createForm();
        $version = $this->versionId($form);
        $ids = [];
        foreach (['A', 'B', 'C'] as $name) {
            $ids[] = $this->addCriterion($form, $version, ['name' => $name])->json('data.id');
        }
        $base = "/api/v1/evaluation-forms/{$form}/versions/{$version}/criteria";

        $this->actor()->putJson("{$base}/order", ['order' => [$ids[2], $ids[0], $ids[1]]])
            ->assertOk()->assertJsonPath('data.0.name', 'C')->assertJsonPath('data.2.name', 'B');
        $this->actor()->putJson("{$base}/order", ['order' => [$ids[0]]])->assertUnprocessable()->assertJsonValidationErrors('order');

        $this->actor()->deleteJson("{$base}/{$ids[2]}")->assertNoContent();
        $this->assertSame(1, EvaluationCriterion::find($ids[0])->display_order);
        $this->assertSame(2, EvaluationCriterion::find($ids[1])->display_order);
    }

    public function test_form_status_rules(): void
    {
        $form = $this->createForm();

        $this->actor()->patchJson("/api/v1/evaluation-forms/{$form}/status", ['status' => 'active'])->assertUnprocessable();
        $this->actor()->patchJson("/api/v1/evaluation-forms/{$form}/status", ['status' => 'draft'])->assertUnprocessable();
        $this->actor()->patchJson("/api/v1/evaluation-forms/{$form}/status", ['status' => 'bogus'])->assertUnprocessable();

        $published = $this->publishedVersion($this->admin)->evaluation_form_id;
        $this->actor()->patchJson("/api/v1/evaluation-forms/{$published}/status", ['status' => 'inactive'])
            ->assertOk()->assertJsonPath('data.status', 'inactive');
        $this->actor()->patchJson("/api/v1/evaluation-forms/{$published}/status", ['status' => 'active'])
            ->assertOk()->assertJsonPath('data.status', 'active');
    }

    public function test_list_search_and_status_filter(): void
    {
        $this->actor()->postJson('/api/v1/evaluation-forms', ['name' => 'Zzqx Speaking'])->assertCreated();
        $published = $this->publishedVersion($this->admin);

        $this->actor()->getJson('/api/v1/evaluation-forms?search=zzqx')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'draft')->assertJsonPath('data.0.has_draft', true);
        $this->actor()->getJson('/api/v1/evaluation-forms?status=active')->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.latest_published_version', 1)->assertJsonPath('data.0.id', $published->evaluation_form_id);
        $this->actor()->getJson('/api/v1/evaluation-forms?search=%25')->assertJsonCount(0, 'data');
        $this->actor()->getJson('/api/v1/evaluation-forms?sort=password')->assertUnprocessable();
    }

    public function test_a_version_cannot_be_reached_through_another_form(): void
    {
        $a = $this->createForm();
        $b = $this->createForm();

        $this->addCriterion($b, $this->versionId($a))->assertNotFound();
        $this->actor()->getJson("/api/v1/evaluation-forms/{$b}/versions/{$this->versionId($a)}")->assertNotFound();
    }

    public function test_assigning_a_form_pins_the_latest_published_version(): void
    {
        $v1 = $this->publishedVersion($this->admin);
        $form = $v1->evaluation_form_id;
        $event = Event::factory()->create();

        $this->actor()->putJson("/api/v1/events/{$event->id}/form", ['form_id' => $form])
            ->assertOk()
            ->assertJsonPath('data.evaluation_form_version_id', $v1->id)
            ->assertJsonPath('data.form.version_number', 1);

        // A newer version is published later: the event keeps the version it was given.
        $v2 = $this->actor()->postJson("/api/v1/evaluation-forms/{$form}/versions")->json('data.id');
        $this->publish($form, $v2)->assertOk();
        $this->assertSame($v1->id, $event->fresh()->evaluation_form_version_id);

        // Assigning again picks up version 2.
        $this->actor()->putJson("/api/v1/events/{$event->id}/form", ['form_id' => $form])
            ->assertOk()->assertJsonPath('data.form.version_number', 2);

        $this->actor()->deleteJson("/api/v1/events/{$event->id}/form")->assertOk()->assertJsonPath('data.form', null);
        $this->assertDatabaseHas('audit_logs', ['action' => 'event.form_assigned', 'auditable_id' => $event->id]);
    }

    public function test_only_active_published_forms_can_be_assigned(): void
    {
        $event = Event::factory()->create();

        $draftOnly = $this->createForm();
        $this->actor()->putJson("/api/v1/events/{$event->id}/form", ['form_id' => $draftOnly])
            ->assertUnprocessable()->assertJsonValidationErrors('form_id');

        $inactive = $this->publishedVersion($this->admin)->evaluation_form_id;
        $this->actor()->patchJson("/api/v1/evaluation-forms/{$inactive}/status", ['status' => 'inactive'])->assertOk();
        $this->actor()->putJson("/api/v1/events/{$event->id}/form", ['form_id' => $inactive])->assertUnprocessable();

        $this->actor()->putJson("/api/v1/events/{$event->id}/form", ['form_id' => 999999])
            ->assertUnprocessable()->assertJsonValidationErrors('form_id');
    }

    public function test_form_cannot_change_once_the_event_has_started(): void
    {
        $form = $this->publishedVersion($this->admin)->evaluation_form_id;
        $event = Event::factory()->withStatus(EventStatus::InProgress)->create();

        $this->actor()->putJson("/api/v1/events/{$event->id}/form", ['form_id' => $form])
            ->assertUnprocessable()->assertJsonValidationErrors('event');
        $this->actor()->deleteJson("/api/v1/events/{$event->id}/form")->assertUnprocessable();
    }

    public function test_an_event_cannot_start_without_a_form(): void
    {
        $event = Event::factory()->withStatus(EventStatus::Upcoming)->create();
        Participant::factory()->create(['event_id' => $event->id, 'presentation_order' => 1]);
        $event->judges()->attach(User::factory()->judge()->create()->id, ['assigned_by' => $this->admin->id]);

        $this->actor()->patchJson("/api/v1/events/{$event->id}/status", ['status' => 'in_progress'])
            ->assertUnprocessable()->assertJsonValidationErrors('status');

        $form = $this->publishedVersion($this->admin)->evaluation_form_id;
        $this->actor()->putJson("/api/v1/events/{$event->id}/form", ['form_id' => $form])->assertOk();
        $this->actor()->patchJson("/api/v1/events/{$event->id}/status", ['status' => 'in_progress'])->assertOk();
    }

    public function test_errors_follow_accept_language(): void
    {
        $form = $this->createForm();

        $this->actor()->withHeader('Accept-Language', 'km')
            ->postJson("/api/v1/evaluation-forms/{$form}/versions/{$this->versionId($form)}/publish")
            ->assertUnprocessable()
            ->assertJsonPath('errors.version.0', 'សូមបន្ថែមលក្ខណៈវិនិច្ឆ័យសកម្មយ៉ាងតិចមួយ មុនពេលផ្សព្វផ្សាយ។');
    }
}