<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EvaluationCriterion extends Model
{
    protected $table = 'evaluation_criteria';

    protected $fillable = [
        'name', 'description', 'min_score', 'max_score',
        'weight', 'display_order', 'is_required', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'min_score' => 'decimal:2',
            'max_score' => 'decimal:2',
            'weight' => 'decimal:2',
            'is_required' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function version()
    {
        return $this->belongsTo(EvaluationFormVersion::class, 'evaluation_form_version_id');
    }
}