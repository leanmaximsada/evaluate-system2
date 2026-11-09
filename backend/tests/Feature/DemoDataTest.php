<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\EvaluationForm;
use App\Models\EventSponsor;
use App\Models\Participant;
use App\Models\ParticipantResult;
use App\Models\ResultPublication;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DemoDataTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'Demo-Pass-123x';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    private function runSeed(array $options = []): int
    {
        return Artisan::call('demo:seed', array_merge(['--password' => self::PASSWORD], $options));
    }

    private function demoUsers(): int
    {
        return User::where('email', 'like', '%@demo.test')->count();
    }

    private function resultFor(string $eventCode, string $participantName): ParticipantResult
    {
        $event = Event::where('code', $eventCode)->firstOrFail();
        $participant = Participant::where('event_id', $event->id)->where('name', $participantName)->firstOrFail();

        return ParticipantResult::where('participant_id', $participant->id)->firstOrFail();
    }

    public function test_it_builds_a_consistent_marked_demo(): void
    {
        $this->assertSame(0, $this->runSeed());

        $this->assertSame(7, $this->demoUsers());
        $this->assertSame(2, User::where('email', 'like', '%@demo.test')->where('role', 'admin')->count());
        $this->assertSame(5, User::where('email', 'like', '%@demo.test')->where('role', 'judge')->count());

        $events = Event::orderBy('code')->get()->keyBy('code');
        $this->assertSame(['DEMO-ENG', 'DEMO-HACK', 'DEMO-PITCH', 'DEMO-SCI'], $events->keys()->all());
        $this->assertSame('completed', $events['DEMO-ENG']->status->value);
        $this->assertSame('draft', $events['DEMO-HACK']->status->value);
        $this->assertSame('upcoming', $events['DEMO-PITCH']->status->value);
        $this->assertSame('in_progress', $events['DEMO-SCI']->status->value);

        $forms = EvaluationForm::orderBy('id')->get();
        $this->assertCount(2, $forms);
        $this->assertStringStartsWith('[Demo] ', $forms[0]->name);
        $this->assertSame(2, $forms[0]->versions()->count());
        $this->assertSame('draft', $forms[0]->versions()->where('version_number', 2)->value('status'));

        $this->assertSame(24, DB::table('evaluations')->where('status', 'submitted')->count());
        $this->assertSame(1, DB::table('evaluations')->where('status', 'draft')->count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'demo.seeded']);
    }

    public function test_the_completed_event_has_a_correct_published_ranking_with_a_tie(): void
    {
        $this->runSeed();

        $this->assertSame('89.43', $this->resultFor('DEMO-ENG', 'Team Alpha')->aggregate_score);
        $this->assertSame(1, $this->resultFor('DEMO-ENG', 'Team Alpha')->rank);

        $beta = $this->resultFor('DEMO-ENG', 'Team Beta');
        $delta = $this->resultFor('DEMO-ENG', 'Team Delta');
        $this->assertSame('84.10', $beta->aggregate_score);
        $this->assertSame(2, $beta->rank);
        $this->assertSame(2, $delta->rank);
        $this->assertTrue($beta->is_tied && $delta->is_tied);

        $this->assertSame(4, $this->resultFor('DEMO-ENG', 'Team Gamma')->rank);
        $this->assertSame(6, $this->resultFor('DEMO-ENG', 'Team Zeta')->rank);
        $this->assertTrue($this->resultFor('DEMO-ENG', 'Team Alpha')->is_complete);

        $this->assertSame(1, ResultPublication::where('status', 'published')->count());

        $this->getJson('/api/v1/public/events/DEMO-ENG/results')
            ->assertOk()
            ->assertJsonCount(6, 'data.rows')
            ->assertJsonPath('data.rows.0.name', 'Team Alpha')
            ->assertJsonPath('data.rows.0.score', '89.43')
            ->assertJsonPath('data.is_final', true);
    }

    public function test_sponsors_are_created_when_the_gd_extension_is_available(): void
    {
        $this->runSeed();

        if (! function_exists('imagecreatetruecolor')) {
            $this->assertSame(0, EventSponsor::count());

            return;
        }

        $this->assertSame(9, EventSponsor::count());
        $this->assertCount(9, Storage::disk('public')->allFiles());
        $this->getJson('/api/v1/public/events/DEMO-ENG/results')
            ->assertJsonCount(9, 'data.sponsors')
            ->assertJsonPath('data.sponsors.0.tier', 'diamond');
    }

    public function test_the_event_in_progress_has_provisional_incomplete_results(): void
    {
        $this->runSeed();

        $first = $this->resultFor('DEMO-SCI', 'Poster 1');
        $this->assertSame(2, $first->evaluations_submitted);
        $this->assertSame(3, $first->judges_assigned);
        $this->assertFalse($first->is_complete);

        // The draft by the third judge is never counted.
        $this->assertSame(1, $this->resultFor('DEMO-SCI', 'Poster 3')->evaluations_submitted);
        $this->assertSame(1, $this->resultFor('DEMO-SCI', 'Poster 4')->evaluations_submitted);
        $this->assertNotNull($first->rank);
    }

    public function test_the_demo_accounts_can_sign_in(): void
    {
        $this->runSeed();

        $this->spa()->postJson('/api/v1/auth/login', ['email' => 'demo.admin1@demo.test', 'password' => self::PASSWORD])
            ->assertOk()->assertJsonPath('data.role', 'admin');
        $this->spa()->postJson('/api/v1/auth/login', ['email' => 'demo.judge1@demo.test', 'password' => self::PASSWORD])
            ->assertOk()->assertJsonPath('data.role', 'judge');
    }

    public function test_a_second_run_is_refused_unless_fresh_and_fresh_does_not_duplicate(): void
    {
        $this->assertSame(0, $this->runSeed());

        $this->assertSame(1, $this->runSeed());
        $this->assertSame(7, $this->demoUsers());

        $this->assertSame(0, $this->runSeed(['--fresh' => true]));
        $this->assertSame(7, $this->demoUsers());
        $this->assertSame(4, Event::count());
        $this->assertSame(2, EvaluationForm::count());
        $this->assertSame(25, DB::table('evaluations')->count());
    }

    public function test_reset_removes_only_the_demo_data(): void
    {
        $realAdmin = User::factory()->admin()->create(['email' => 'real.admin@example.test']);
        $realEvent = Event::factory()->create(['code' => 'REAL-1', 'created_by' => $realAdmin->id]);

        $this->runSeed();
        $this->assertSame(0, Artisan::call('demo:reset', ['--force' => true]));

        $this->assertSame(0, $this->demoUsers());
        $this->assertSame(0, Event::withTrashed()->where('code', 'like', 'DEMO-%')->count());
        $this->assertSame(0, EvaluationForm::count());
        $this->assertSame(0, EventSponsor::count());
        $this->assertSame(0, DB::table('evaluations')->count());
        $this->assertSame(0, ParticipantResult::count());
        $this->assertSame(0, ResultPublication::count());
        $this->assertSame([], Storage::disk('public')->allFiles());

        $this->assertModelExists($realAdmin);
        $this->assertModelExists($realEvent);
    }

    public function test_reset_without_confirmation_changes_nothing(): void
    {
        $this->runSeed();

        // Not interactive and no --force, so the confirmation defaults to "no".
        $this->assertSame(1, Artisan::call('demo:reset'));
        $this->assertSame(7, $this->demoUsers());
    }

    public function test_it_refuses_to_run_in_production(): void
    {
        $this->app['env'] = 'production';

        try {
            $this->assertSame(1, $this->runSeed());
            $this->assertSame(1, Artisan::call('demo:reset', ['--force' => true]));
        } finally {
            $this->app['env'] = 'testing';
        }

        $this->assertSame(0, User::count());
        $this->assertSame(0, Event::count());
    }

    public function test_a_random_password_is_generated_and_a_weak_one_is_refused(): void
    {
        $this->assertSame(1, Artisan::call('demo:seed', ['--password' => 'weak']));
        $this->assertSame(0, $this->demoUsers());

        $this->assertSame(0, Artisan::call('demo:seed'));
        $this->assertSame(1, preg_match('/Password: (\S+)/', Artisan::output(), $match));

        $this->spa()->postJson('/api/v1/auth/login', ['email' => 'demo.admin1@demo.test', 'password' => $match[1]])->assertOk();
    }
}