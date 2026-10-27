<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

use function Laravel\Prompts\password;
use function Laravel\Prompts\text;

class CreateSuperAdmin extends Command
{
    protected $signature = 'app:create-super-admin';

    protected $description = 'Create a Super Admin account (interactive; password is never echoed or stored in files)';

    public function handle(AuditLogger $audit): int
    {
        $name = text('Full name', required: true);

        $email = text('Email', required: true, validate: function (string $value) {
            if (! filter_var($value, FILTER_VALIDATE_EMAIL)) {
                return 'Enter a valid email address.';
            }

            return User::where('email', $value)->exists() ? 'That email is already in use.' : null;
        });

        $plain = password('Password (min 10 chars, mixed case, with a number)', required: true, validate: function (string $value) {
            $validator = Validator::make(['password' => $value], ['password' => [Password::defaults()]]);

            return $validator->fails() ? $validator->errors()->first('password') : null;
        });

        $user = new User(['name' => $name, 'email' => $email, 'password' => $plain]);
        $user->role = Role::SuperAdmin;
        $user->is_active = true;
        $user->email_verified_at = now();
        $user->save();

        $audit->log('user.super_admin_created', $user, ['via' => 'cli']);

        $this->info("Super Admin created: {$user->email}");

        return self::SUCCESS;
    }
}