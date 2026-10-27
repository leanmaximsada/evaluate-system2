<?php

namespace App\Enums;

enum Permission: string
{
    case UsersManage = 'users.manage';
    case SettingsManage = 'settings.manage';
    case EventsManage = 'events.manage';
    case JudgesAssign = 'judges.assign';
    case FormsManage = 'forms.manage';
    case ResultsView = 'results.view';
    case ResultsPublish = 'results.publish';
    case ResultsUnpublish = 'results.unpublish';
    case ResultsExport = 'results.export';
    case AuditView = 'audit.view';
}