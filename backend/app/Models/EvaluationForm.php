<?php

namespace App\Models;

use App\Enums\FormStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class EvaluationForm extends Model
{
    use SoftDeletes;

    protected $fillable = ['name', 'description'];

    protected function casts(): array
    {
        return ['status' => FormStatus::class];
    }

    public function versions()
    {
        return $this->hasMany(EvaluationFormVersion::class)->orderBy('version_number');
    }

    public function latestVersion()
    {
        return $this->hasOne(EvaluationFormVersion::class)->latestOfMany('version_number');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}