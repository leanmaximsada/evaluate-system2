<?php

namespace Database\Factories;

use App\Enums\EventStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class EventFactory extends Factory
{
    public function definition(): array
    {
        $start = now()->addDays(7)->startOfHour();

        return [
            'name' => fake()->words(3, true),
            'code' => strtoupper(fake()->unique()->bothify('EV-####')),
            'description' => null,
            'venue' => fake()->city(),
            'starts_at' => $start,
            'ends_at' => $start->copy()->addHours(4),
            'timezone' => 'Asia/Phnom_Penh',
            'category' => 'Competition',
            'status' => EventStatus::Draft,
            'created_by' => User::factory()->admin(),
        ];
    }

    public function withStatus(EventStatus $status): static
    {
        return $this->state(['status' => $status]);
    }
}