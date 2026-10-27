<?php

namespace App\Models;

use App\Enums\EvaluationStatus;
use Illuminate\Database\Eloquent\Model;

class Evaluation extends Model
{
    protected $fillable = [];

    protected function casts(): array
    {
        return [
            'status' => EvaluationStatus::class,
            'total_score' => 'decimal:2',
            'submitted_at' => 'datetime',
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

    public function judge()
    {
        return $this->belongsTo(User::class, 'judge_id');
    }

    public function formVersion()
    {
        return $this->belongsTo(EvaluationFormVersion::class, 'evaluation_form_version_id');
    }

    public function scores()
    {
        return $this->hasMany(EvaluationScore::class);
    }

    public function revisions()
    {
        return $this->hasMany(EvaluationScoreRevision::class)->orderBy('revision');
    }
}