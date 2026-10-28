<?php

namespace App\Services;

use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class SettingsService
{
    public function __construct(private readonly AuditLogger $audit) {}

    /** @return array<string, mixed> Flat "group.key" => default value. This is the whitelist of editable settings. */
    public function defaults(): array
    {
        return [
            'general.system_name' => 'Evaluation System',
            'general.default_language' => 'en',
            'general.timezone' => config('app.timezone', 'UTC'),
            'general.date_format' => 'Y-m-d',
            'general.time_format' => '24h',
            'general.pagination_size' => 15,

            'evaluation.min_score' => 0,
            'evaluation.max_score' => 100,
            'evaluation.score_precision' => 2,
            'evaluation.tie_policy' => 'standard', // standard = 1,2,2,4  |  dense = 1,2,2,3
            'evaluation.show_tie_indicator' => true,
            'evaluation.live_provisional_enabled' => true,
            'evaluation.default_result_visibility' => 'rank_and_score', // rank_and_score | rank_only | hidden
        ];
    }

    /** @return array<string, array<string, mixed>> Nested by group, with defaults filled in. */
    public function all(): array
    {
        $stored = SystemSetting::query()->get()->mapWithKeys(fn (SystemSetting $s) => [$s->key => $s->value]);

        $flat = [];
        foreach ($this->defaults() as $key => $default) {
            $flat[$key] = $stored->has($key) ? $stored->get($key) : $default;
        }

        return Arr::undot($flat);
    }

    /** Convenience for other services, e.g. $settings->get('evaluation.tie_policy'). */
    public function get(string $key): mixed
    {
        return Arr::get($this->all(), $key);
    }

    /**
     * @param  array<string, mixed>  $input  Validated, nested settings.
     * @return array<string, array<string, mixed>>
     */
    public function update(array $input, User $actor): array
    {
        $defaults = $this->defaults();
        $incoming = Arr::dot($input);
        $current = Arr::dot($this->all());

        DB::transaction(function () use ($defaults, $incoming, $current, $actor) {
            $changes = [];

            foreach ($defaults as $key => $default) {
                if (! array_key_exists($key, $incoming)) {
                    continue;
                }

                $new = $this->normalize($incoming[$key], $default);
                $old = $this->normalize($current[$key], $default);

                if ($new === $old) {
                    continue;
                }

                $row = SystemSetting::firstOrNew(['key' => $key]);
                $row->group = explode('.', $key, 2)[0];
                $row->value = $new;
                $row->updated_by = $actor->id;
                $row->save();

                $changes[$key] = ['from' => $old, 'to' => $new];
            }

            if ($changes !== []) {
                $this->audit->log('settings.updated', null, ['changes' => $changes], $actor);
            }
        });

        return $this->all();
    }

    private function normalize(mixed $value, mixed $default): mixed
    {
        if (is_bool($default)) {
            return filter_var($value, FILTER_VALIDATE_BOOLEAN);
        }

        if (is_int($default) || is_float($default)) {
            $number = round((float) $value, 2);

            return floor($number) === $number ? (int) $number : $number;
        }

        return (string) $value;
    }
}