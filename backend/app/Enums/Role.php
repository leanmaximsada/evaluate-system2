<?php

namespace App\Enums;

enum Role: string
{
    case SuperAdmin = 'super_admin';
    case Admin = 'admin';
    case Judge = 'judge';

    /** @return list<Permission> */
    public function permissions(): array
    {
        return match ($this) {
            self::SuperAdmin => Permission::cases(),
            self::Admin => [
                Permission::EventsManage,
                Permission::JudgesAssign,
                Permission::FormsManage,
                Permission::ResultsView,
                Permission::ResultsPublish,
                Permission::ResultsExport,
            ],
            self::Judge => [],
        };
    }
}