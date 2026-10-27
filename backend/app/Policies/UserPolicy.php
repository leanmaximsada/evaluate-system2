<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\User;

class UserPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission(Permission::UsersManage);
    }

    public function view(User $actor, User $target): bool
    {
        return $actor->hasPermission(Permission::UsersManage);
    }

    public function create(User $actor): bool
    {
        return $actor->hasPermission(Permission::UsersManage);
    }

    public function update(User $actor, User $target): bool
    {
        return $actor->hasPermission(Permission::UsersManage);
    }

    public function changeStatus(User $actor, User $target): bool
    {
        return $actor->hasPermission(Permission::UsersManage);
    }
}