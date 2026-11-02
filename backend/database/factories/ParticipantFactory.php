<?php

namespace Database\Factories;

use App\Models\Event;
use Illuminate\Database\Eloquent\Factories\Factory;

class ParticipantFactory extends Factory
{
    public function definition(): array
    {
        return [
            'event_id' => Event::factory(),
            'name' => fake()->name(),
            'number' => (string) fake()->unique()->numberBetween(1, 99999),
            'team_name' => null,
            'description' => null,
            'presentation_order' => null,
            'status' => 'registered',
        ];
    }
}