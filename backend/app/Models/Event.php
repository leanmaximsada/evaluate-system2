<?php

namespace App\Models;

use App\Enums\EventStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Facades\Storage;

class Event extends Model
{
    use HasFactory, SoftDeletes;

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

    public function sponsors()
    {
        return $this->hasMany(EventSponsor::class);
    }
    public function organizationLogoUrl(): ?string
    {
        if (! $this->organization_logo_path) {
            return null;
        }

        /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
        $disk = Storage::disk('public');

        return $disk->url($this->organization_logo_path);
    }

    /** @return array{name: ?string, logo_url: ?string}|null Public fields only. */
    public function publicOrganization(): ?array
    {
        if (! $this->organization_name && ! $this->organization_logo_path) {
            return null;
        }

        return ['name' => $this->organization_name, 'logo_url' => $this->organizationLogoUrl()];
    }
}