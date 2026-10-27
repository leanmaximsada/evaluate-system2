<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EvaluationFormVersion extends Model
{
    protected $fillable = ['is_weighted'];

    protected function casts(): array
    {
        return [
            'is_weighted' => 'boolean',
            'published_at' => 'datetime',
        ];
    }

    public function form()
    {
        return $this->belongsTo(EvaluationForm::class, 'evaluation_form_id');
    }

    public function criteria()
    {
        return $this->hasMany(EvaluationCriterion::class)->orderBy('display_order');
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }
}