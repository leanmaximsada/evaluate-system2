<?php

namespace App\Models;

use App\Enums\EventStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Event extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name', 'code', 'description', 'venue', 'starts_at',
        'ends_at', 'timezone', 'category',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'status' => EventStatus::class,
            'scoring_policy' => 'array',
        ];
    }

    public function participants()
    {
        return $this->hasMany(Participant::class)->orderBy('presentation_order');
    }

    public function judges()
    {
        return $this->belongsToMany(User::class, 'event_judges')->withPivot('assigned_by')->withTimestamps();
    }

    public function formVersion()
    {
        return $this->belongsTo(EvaluationFormVersion::class, 'evaluation_form_version_id');
    }

    public function evaluations()
    {
        return $this->hasMany(Evaluation::class);
    }

    public function results()
    {
        return $this->hasMany(ParticipantResult::class);
    }

    public function publications()
    {
        return $this->hasMany(ResultPublication::class)->orderByDesc('revision');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}