<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class UserService
{
    public function __construct(private readonly AuditLogger $audit) {}

    /** @param array<string, mixed> $data */
    public function create(array $data, User $actor): User
    {
        return DB::transaction(function () use ($data, $actor) {
            $user = new User(['name' => $data['name'], 'email' => $data['email'], 'password' => $data['password']]);
            $user->role = Role::from($data['role']);
            $user->is_active = true;
            $user->email_verified_at = Carbon::now();
            $user->save();

            $this->audit->log('user.created', $user, ['email' => $user->email, 'role' => $user->role->value], $actor);

            return $user;
        });
    }

    /** @param array<string, mixed> $data */
    public function update(User $target, array $data, User $actor): User
    {
        return DB::transaction(function () use ($target, $data, $actor) {
            $previousRole = $target->role;
            $newRole = Role::from($data['role']);
            $roleChanged = $newRole !== $previousRole;

            if ($roleChanged) {
                if ($target->is($actor)) {
                    throw ValidationException::withMessages(['role' => ['You cannot change your own role.']]);
                }
                $this->assertNotLastActiveSuperAdmin($target, 'role', 'The last active Super Admin cannot be demoted.');
            }

            $target->fill(['name' => $data['name'], 'email' => $data['email']]);
            $target->role = $newRole;
            $profileFields = array_values(array_diff(array_keys($target->getDirty()), ['role']));
            $target->save();

            if ($profileFields !== []) {
                $this->audit->log('user.updated', $target, ['fields' => $profileFields], $actor);
            }
            if ($roleChanged) {
                $this->audit->log('user.role_changed', $target, [
                    'from' => $previousRole?->value,
                    'to' => $newRole->value,
                ], $actor);
            }

            return $target;
        });
    }

    public function setStatus(User $target, bool $active, User $actor): User
    {
        return DB::transaction(function () use ($target, $active, $actor) {
            if (! $active) {
                if ($target->is($actor)) {
                    throw ValidationException::withMessages(['is_active' => ['You cannot deactivate your own account.']]);
                }
                $this->assertNotLastActiveSuperAdmin($target, 'is_active', 'The last active Super Admin cannot be deactivated.');
            }

            if ($target->is_active === $active) {
                return $target;
            }

            $target->is_active = $active;
            $target->save();

            if (! $active) {
                // End any live sessions immediately.
                DB::table('sessions')->where('user_id', $target->id)->delete();
                $target->tokens()->delete();
            }

            $this->audit->log($active ? 'user.activated' : 'user.deactivated', $target, [], $actor);

            return $target;
        });
    }

    public function sendPasswordReset(User $target, User $actor): void
    {
        if (! $target->is_active) {
            throw ValidationException::withMessages(['user' => ['Cannot send a reset link to a deactivated account.']]);
        }

        $status = Password::sendResetLink(['email' => $target->email]);

        // 'passwords.sent' is Laravel's status string for a sent link; anything else is a throttle or failure.
        if ($status !== 'passwords.sent') {
            throw ValidationException::withMessages(['user' => [__($status)]]);
        }

        $this->audit->log('user.password_reset_requested', $target, [], $actor);
    }

    /**
     * Must run inside a transaction. Locking the other Super Admin rows makes two
     * simultaneous demotions deadlock (one aborts) instead of leaving zero Super Admins.
     */
    private function assertNotLastActiveSuperAdmin(User $target, string $field, string $message): void
    {
        if ($target->role !== Role::SuperAdmin || ! $target->is_active) {
            return;
        }

        $others = User::query()
            ->where('role', Role::SuperAdmin->value)
            ->where('is_active', true)
            ->where('id', '!=', $target->id)
            ->lockForUpdate()
            ->pluck('id');

        if ($others->isEmpty()) {
            throw ValidationException::withMessages([$field => [$message]]);
        }
    }
}