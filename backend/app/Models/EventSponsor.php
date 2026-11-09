<?php

namespace App\Models;

use App\Enums\SponsorTier;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class EventSponsor extends Model
{
    protected $fillable = [];

    protected function casts(): array
    {
        return ['tier' => SponsorTier::class];
    }

    public function event()
    {
        return $this->belongsTo(Event::class);
    }

    public function logoUrl(): string
    {
        return Storage::disk('public')->url($this->logo_path);
    }
}