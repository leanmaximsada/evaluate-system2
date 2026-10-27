<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EvaluationScoreRevision extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [];

    protected function casts(): array
    {
        return [
            'previous_scores' => 'array',
            'previous_total' => 'decimal:2',
        ];
    }

    public function evaluation()
    {
        return $this->belongsTo(Evaluation::class);
    }

    public function changedBy()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}