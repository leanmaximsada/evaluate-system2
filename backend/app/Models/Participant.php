<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Participant extends Model
{
    protected $fillable = ['name', 'number', 'team_name', 'description', 'presentation_order'];

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function evaluations()
    {
        return $this->hasMany(Evaluation::class);
    }

    public function result()
    {
        return $this->hasOne(ParticipantResult::class);
    }
}