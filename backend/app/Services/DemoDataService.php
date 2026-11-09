<?php

namespace App\Services;

use App\Enums\EventStatus;
use App\Enums\Role;
use App\Models\EvaluationForm;
use App\Models\Event;
use App\Models\EventSponsor;
use App\Models\Participant;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * Builds and removes clearly marked demo data. Everything goes through the real services, so totals,
 * ranks, the published snapshot and the audit log are produced exactly as in normal use.
 *
 * Markers: accounts end in @demo.test, event codes start with DEMO-, form names start with "[Demo] ".
 */
class DemoDataService
{
    public const EMAIL_DOMAIN = 'demo.test';
    public const EVENT_PREFIX = 'DEMO-';
    public const FORM_PREFIX = '[Demo] ';

    private const TIMEZONE = 'Asia/Phnom_Penh';

    /** @var list<array{0: string, 1: string, 2: list<int>}> */
    private const SPONSORS = [
        ['diamond', 'Aurora Labs', [88, 28, 135]],
        ['gold', 'Nova Systems', [180, 83, 9]],
        ['gold', 'Bluewave Tech', [3, 105, 161]],
        ['silver', 'Greenfield', [21, 128, 61]],
        ['silver', 'Orbit Cloud', [67, 56, 202]],
        ['silver', 'Sunrise Co', [194, 65, 12]],
        ['silver', 'Pixel Forge', [190, 18, 60]],
        ['supporter', 'City Library', [71, 85, 105]],
        ['supporter', 'Tech Club', [13, 148, 136]],
    ];

    /** Four criteria, scored 0 to 100, three judges per team. Beta and Delta are identical on purpose (a tie). */
    private const ENGINEERING_SCORES = [
        [[92, 88, 90, 85], [90, 86, 92, 88], [94, 90, 88, 87]],
        [[85, 82, 80, 88], [84, 85, 82, 86], [86, 80, 83, 90]],
        [[78, 75, 80, 72], [80, 78, 76, 74], [76, 74, 79, 75]],
        [[85, 82, 80, 88], [84, 85, 82, 86], [86, 80, 83, 90]],
        [[70, 68, 72, 75], [72, 70, 69, 73], [68, 71, 70, 74]],
        [[60, 65, 58, 62], [62, 60, 64, 63], [59, 61, 60, 65]],
    ];

    public function __construct(
        private readonly EventService $events,
        private readonly ParticipantService $participants,
        private readonly JudgeAssignmentService $judges,
        private readonly EvaluationFormService $forms,
        private readonly EvaluationService $evaluations,
        private readonly ResultPublicationService $publications,
        private readonly SponsorService $sponsors,
        private readonly EventDisplayService $display,
        private readonly AuditLogger $audit,
    ) {}

    public function exists(): bool
    {
        return User::where('email', 'like', '%@'.self::EMAIL_DOMAIN)->exists()
            || Event::withTrashed()->where('code', 'like', self::EVENT_PREFIX.'%')->exists()
            || EvaluationForm::withTrashed()->where('name', 'like', self::FORM_PREFIX.'%')->exists();
    }

     /** @return array<string, int> What was created. */
    public function seed(string $password): array
    {
        $this->assertNotProduction();

        if ($this->exists()) {
            throw new RuntimeException('Demo data already exists. Run with --fresh to rebuild it.');
        }

        // No real-time server is needed while seeding.
        config(['broadcasting.default' => 'null']);

        $disk = Storage::disk('public');
        $before = $disk->allFiles('sponsors');

        try {
            return DB::transaction(fn () => $this->build($password));
        } catch (Throwable $e) {
            // The database work is rolled back, but uploaded logos are not, so remove them too.
            $disk->delete(array_diff($disk->allFiles('sponsors'), $before));

            throw $e;
        }
    }

    /** @return array<string, int> What was removed. */
    public function reset(): array
    {
        $this->assertNotProduction();

        $logos = [];
        $eventIds = [];

        $counts = DB::transaction(function () use (&$logos, &$eventIds) {
            $eventIds = Event::withTrashed()->where('code', 'like', self::EVENT_PREFIX.'%')->pluck('id')->all();
            $formIds = EvaluationForm::withTrashed()->where('name', 'like', self::FORM_PREFIX.'%')->pluck('id')->all();
            $userIds = User::where('email', 'like', '%@'.self::EMAIL_DOMAIN)->pluck('id')->all();

            $evaluationIds = DB::table('evaluations')->whereIn('event_id', $eventIds)->pluck('id')->all();
            $logos = DB::table('event_sponsors')->whereIn('event_id', $eventIds)->pluck('logo_path')->all();
            $versionIds = DB::table('evaluation_form_versions')->whereIn('evaluation_form_id', $formIds)->pluck('id')->all();

            DB::table('evaluation_score_revisions')->whereIn('evaluation_id', $evaluationIds)->delete();
            DB::table('evaluation_scores')->whereIn('evaluation_id', $evaluationIds)->delete();
            DB::table('evaluations')->whereIn('id', $evaluationIds)->delete();
            DB::table('participant_results')->whereIn('event_id', $eventIds)->delete();
            DB::table('result_publications')->whereIn('event_id', $eventIds)->delete();
            DB::table('event_sponsors')->whereIn('event_id', $eventIds)->delete();
            DB::table('event_judges')->whereIn('event_id', $eventIds)->delete();
            DB::table('participants')->whereIn('event_id', $eventIds)->delete();
            DB::table('events')->whereIn('id', $eventIds)->delete();

            DB::table('evaluation_criteria')->whereIn('evaluation_form_version_id', $versionIds)->delete();
            DB::table('evaluation_form_versions')->whereIn('id', $versionIds)->delete();
            DB::table('evaluation_forms')->whereIn('id', $formIds)->delete();

            DB::table('sessions')->whereIn('user_id', $userIds)->delete();
            DB::table('password_reset_tokens')->where('email', 'like', '%@'.self::EMAIL_DOMAIN)->delete();
            DB::table('users')->whereIn('id', $userIds)->delete();

            return ['users' => count($userIds), 'forms' => count($formIds), 'events' => count($eventIds), 'sponsors' => count($logos)];
        });

        // Files are removed only after the database changes are safely committed.
        Storage::disk('public')->delete($logos);
        foreach ($eventIds as $id) {
            Storage::disk('public')->deleteDirectory("sponsors/{$id}");
        }

        return $counts;
    }

    /** @return array<string, int> */
    private function build(string $password): array
    {
        $hash = Hash::make($password); // hashed once and reused, so seeding stays fast

        $admins = [
            $this->makeUser('Demo Admin One', 'demo.admin1', Role::Admin, $hash),
            $this->makeUser('Demo Admin Two', 'demo.admin2', Role::Admin, $hash),
        ];
        $judges = [
            $this->makeUser('Dr. Sokha Chan', 'demo.judge1', Role::Judge, $hash),
            $this->makeUser('Prof. Dara Kim', 'demo.judge2', Role::Judge, $hash),
            $this->makeUser('Ms. Sreyleak Heng', 'demo.judge3', Role::Judge, $hash),
            $this->makeUser('Mr. Vibol Sok', 'demo.judge4', Role::Judge, $hash),
            $this->makeUser('ចាន់ សុខា', 'demo.judge5', Role::Judge, $hash),
        ];
        $admin = $admins[0];

        $weighted = $this->makeForm($admin, 'Presentation Scoring', 'Demo data: a weighted rubric for presentations.', true, [
            ['Content and knowledge', 'Accuracy and depth of the content.', 0, 100, 30],
            ['Presentation skills', 'Structure, pace and delivery.', 0, 100, 25],
            ['Creativity and innovation', 'Originality of the idea and its approach.', 0, 100, 25],
            ['Communication', 'Clarity when answering questions.', 0, 100, 20],
        ]);
        $quick = $this->makeForm($admin, 'Poster Quick Score', 'Demo data: an unweighted form, every criterion counts equally.', false, [
            ['Clarity', 'Is the poster easy to understand?', 1, 10, 0],
            ['Originality', 'Is the idea new?', 1, 10, 0],
            ['Visual design', 'Layout, colour and readability.', 1, 10, 0],
        ]);
        $this->forms->createVersion($weighted, $admin); // left as an unpublished draft to show versioning

        $this->buildEngineeringDays($admin, $weighted, array_slice($judges, 0, 3));
        $this->buildScienceFair($admin, $quick, array_slice($judges, 0, 3));
        $this->buildPitch($admin, $weighted, array_slice($judges, 3, 2));
        $this->buildHackathon($admin);

        $summary = [
            'accounts' => User::where('email', 'like', '%@'.self::EMAIL_DOMAIN)->count(),
            'forms' => EvaluationForm::where('name', 'like', self::FORM_PREFIX.'%')->count(),
            'events' => Event::where('code', 'like', self::EVENT_PREFIX.'%')->count(),
            'participants' => Participant::whereIn('event_id', $this->demoEventIds())->count(),
            'evaluations' => DB::table('evaluations')->whereIn('event_id', $this->demoEventIds())->count(),
            'sponsors' => EventSponsor::whereIn('event_id', $this->demoEventIds())->count(),
        ];

        $this->audit->log('demo.seeded', null, $summary);

        return $summary;
    }

    /** Completed and published: a full ranking with a tie, sponsors and subtitle lines. */
    private function buildEngineeringDays(User $admin, EvaluationForm $form, array $judges): void
    {
        $event = $this->events->create([
            'name' => 'Demo: Engineering Days',
            'code' => self::EVENT_PREFIX.'ENG',
            'description' => 'Demo data: a finished event with published results.',
            'venue' => 'Main Hall',
            'category' => 'Demo',
            'timezone' => self::TIMEZONE,
            'starts_at' => '2026-10-20T09:00',
            'ends_at' => '2026-10-20T17:00',
        ], $admin);

        $teams = [
            ['Team Alpha', 'Smart Irrigation Controller'], ['Team Beta', 'Low-cost Water Filter'],
            ['Team Gamma', 'Solar Phone Charger'], ['Team Delta', 'Voice-guided Cane'],
            ['Team Epsilon', 'Campus Bike Share'], ['Team Zeta', 'Recycled Brick Press'],
        ];
        $people = $this->addParticipants($admin, $event, 'D', $teams);
        foreach ($judges as $judge) {
            $this->judges->assign($event, $judge, $admin);
        }
        $this->events->assignForm($event, $form, $admin);
        $event = $this->start($event, $admin);

        foreach (self::ENGINEERING_SCORES as $p => $perJudge) {
            foreach ($perJudge as $j => $values) {
                $this->evaluations->submit($event, $people[$p], $judges[$j], $this->scoreMap($event, $values), $judges[$j]);
            }
        }

        $event = $this->events->changeStatus($event, EventStatus::Completed, $admin);

        foreach (self::SPONSORS as [$tier, $name, $rgb]) {
            $logo = $this->logo($name, $rgb);
            if ($logo === null) {
                break; // no GD extension: the demo works without sponsors
            }
            $this->sponsors->create($event, ['name' => $name, 'tier' => $tier], $logo, $admin);
            @unlink($logo->getPathname());
        }
        $this->display->update($event, [
            'public_subtitle' => "Department: Information Technology\nYear 4 (demo data)",
            'organization_name' => 'Faculty of Engineering (demo)',
        ], $admin);

        $this->publications->publish($event, ['visibility' => 'rank_and_score'], $admin);
    }

    /** In progress and partly scored: provisional results, incomplete evaluations and one draft. */
    private function buildScienceFair(User $admin, EvaluationForm $form, array $judges): void
    {
        $event = $this->events->create([
            'name' => 'Demo: Science Fair',
            'code' => self::EVENT_PREFIX.'SCI',
            'description' => 'Demo data: an event that is being scored right now.',
            'venue' => 'Science Hall',
            'category' => 'Demo',
            'timezone' => self::TIMEZONE,
            'starts_at' => Carbon::now(self::TIMEZONE)->subHour()->format('Y-m-d\TH:i'),
            'ends_at' => Carbon::now(self::TIMEZONE)->addHours(5)->format('Y-m-d\TH:i'),
        ], $admin);

        $people = $this->addParticipants($admin, $event, 'S', [
            ['Poster 1', 'Plant Growth and Light'], ['Poster 2', 'Homemade Battery'],
            ['Poster 3', 'Rainwater Collection'], ['Poster 4', 'Paper Aeroplanes'],
        ]);
        foreach ($judges as $judge) {
            $this->judges->assign($event, $judge, $admin);
        }
        $this->events->assignForm($event, $form, $admin);
        $event = $this->start($event, $admin);

        // Judge 1 has finished, judge 2 is halfway, judge 3 has only a draft (which is never counted).
        $first = [[8, 9, 8], [7, 7, 8], [9, 8, 9], [6, 7, 6]];
        foreach ($first as $p => $values) {
            $this->evaluations->submit($event, $people[$p], $judges[0], $this->scoreMap($event, $values), $judges[0]);
        }
        foreach ([[9, 8, 8], [7, 8, 7]] as $p => $values) {
            $this->evaluations->submit($event, $people[$p], $judges[1], $this->scoreMap($event, $values), $judges[1]);
        }
        $firstCriterion = array_slice($this->scoreMap($event, [5, 5, 5]), 0, 1, true);
        $this->evaluations->saveDraft($event, $people[0], $judges[2], $firstCriterion, $judges[2]);
    }

    /** Upcoming: everything is ready, the event only needs to be started. */
    private function buildPitch(User $admin, EvaluationForm $form, array $judges): void
    {
        $event = $this->events->create([
            'name' => 'Demo: Innovation Pitch',
            'code' => self::EVENT_PREFIX.'PITCH',
            'description' => 'Demo data: an event that has not started yet.',
            'venue' => 'Auditorium',
            'category' => 'Demo',
            'timezone' => self::TIMEZONE,
            'starts_at' => Carbon::now(self::TIMEZONE)->addDays(7)->setTime(9, 0)->format('Y-m-d\TH:i'),
            'ends_at' => Carbon::now(self::TIMEZONE)->addDays(7)->setTime(16, 0)->format('Y-m-d\TH:i'),
        ], $admin);

        $this->addParticipants($admin, $event, 'P', [
            ['Startup One', 'Farm to Market App'], ['Startup Two', 'Smart Parking'], ['Startup Three', 'Clinic Queue Tracker'],
        ]);
        foreach ($judges as $judge) {
            $this->judges->assign($event, $judge, $admin);
        }
        $this->events->assignForm($event, $form, $admin);
        $this->events->changeStatus($event, EventStatus::Upcoming, $admin);
    }

    /** Draft and empty: shows the empty states. */
    private function buildHackathon(User $admin): void
    {
        $this->events->create([
            'name' => 'Demo: Open Hackathon',
            'code' => self::EVENT_PREFIX.'HACK',
            'description' => 'Demo data: a draft event with nothing set up yet.',
            'venue' => 'Innovation Lab',
            'category' => 'Demo',
            'timezone' => self::TIMEZONE,
            'starts_at' => Carbon::now(self::TIMEZONE)->addDays(30)->setTime(9, 0)->format('Y-m-d\TH:i'),
            'ends_at' => Carbon::now(self::TIMEZONE)->addDays(31)->setTime(17, 0)->format('Y-m-d\TH:i'),
        ], $admin);
    }

    private function makeUser(string $name, string $localPart, Role $role, string $hash): User
    {
        $user = new User(['name' => $name, 'email' => $localPart.'@'.self::EMAIL_DOMAIN, 'password' => $hash]);
        $user->role = $role;
        $user->is_active = true;
        $user->email_verified_at = Carbon::now();
        $user->save();

        return $user;
    }

    /** @param list<array{0: string, 1: string, 2: int, 3: int, 4: int}> $criteria */
    private function makeForm(User $admin, string $name, string $description, bool $weighted, array $criteria): EvaluationForm
    {
        $form = $this->forms->create([
            'name' => self::FORM_PREFIX.$name,
            'description' => $description,
            'is_weighted' => $weighted,
        ], $admin);
        $version = $form->versions()->firstOrFail();

        foreach ($criteria as [$title, $guidance, $min, $max, $weight]) {
            $this->forms->addCriterion($version, [
                'name' => $title, 'description' => $guidance, 'min_score' => $min, 'max_score' => $max, 'weight' => $weight,
            ], $admin);
        }

        $this->forms->publish($version, $admin);

        return $form->fresh();
    }

    /**
     * @param  list<array{0: string, 1: string}>  $teams  name and project title
     * @return list<Participant>
     */
    private function addParticipants(User $admin, Event $event, string $prefix, array $teams): array
    {
        $created = [];
        foreach ($teams as $i => [$name, $project]) {
            $created[] = $this->participants->create($event, [
                'name' => $name,
                'number' => sprintf('%s%02d', $prefix, $i + 1),
                'team_name' => $project,
                'description' => null,
            ], $admin);
        }

        return $created;
    }

    private function start(Event $event, User $admin): Event
    {
        $event = $this->events->changeStatus($event, EventStatus::Upcoming, $admin);

        return $this->events->changeStatus($event, EventStatus::InProgress, $admin);
    }

    /**
     * @param  list<int>  $values  one score per criterion, in form order
     * @return array<int, int>
     */
    private function scoreMap(Event $event, array $values): array
    {
        $ids = $event->refresh()->formVersion()->firstOrFail()->criteria()->pluck('id')->all();

        return array_combine($ids, $values);
    }

    /** @return list<int> */
    private function demoEventIds(): array
    {
        return Event::where('code', 'like', self::EVENT_PREFIX.'%')->pluck('id')->all();
    }

    /** A simple generated logo, or null when the GD extension is not installed. @param list<int> $rgb */
    private function logo(string $label, array $rgb): ?UploadedFile
    {
        if (! function_exists('imagecreatetruecolor')) {
            return null;
        }

        $image = imagecreatetruecolor(320, 120);
        imagefill($image, 0, 0, imagecolorallocate($image, $rgb[0], $rgb[1], $rgb[2]));
        $x = max(8, (int) ((320 - strlen($label) * 9) / 2));
        imagestring($image, 5, $x, 52, $label, imagecolorallocate($image, 255, 255, 255));

        $path = tempnam(sys_get_temp_dir(), 'logo');
        imagepng($image, $path);
        imagedestroy($image);

        return new UploadedFile($path, Str::slug($label).'.png', 'image/png', null, true);
    }

    private function assertNotProduction(): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('Demo data is disabled in production.');
        }
    }
}