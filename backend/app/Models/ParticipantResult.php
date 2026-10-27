<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ParticipantResult extends Model
{
    protected $fillable = [];

    protected function casts(): array
    {
        return [
            'aggregate_score' => 'decimal:2',
            'is_tied' => 'boolean',
            'is_complete' => 'boolean',
            'calculated_at' => 'datetime',
        ];
    }

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function participant()
    {
        return $this->belongsTo(Participant::class);
    }
}