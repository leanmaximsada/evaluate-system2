<?php

namespace App\Models;

use App\Enums\Role;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    // role and is_active are deliberately NOT mass-assignable (privilege-escalation guard).
    protected $fillable = ['name', 'email', 'password'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'role' => Role::class,
        ];
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === Role::SuperAdmin;
    }

    public function isAdmin(): bool
    {
        return in_array($this->role, [Role::SuperAdmin, Role::Admin], true);
    }

    public function isJudge(): bool
    {
        return $this->role === Role::Judge;
    }

    public function assignedEvents()
    {
        return $this->belongsToMany(Event::class, 'event_judges')->withPivot('assigned_by')->withTimestamps();
    }
}