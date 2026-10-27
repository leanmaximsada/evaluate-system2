<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class AuditLogger
{
    private const REDACTED_KEYS = [
        'password', 'password_confirmation', 'current_password',
        'token', 'remember_token', 'secret', 'api_key',
    ];

    /**
     * @param  array<string, mixed>  $summary  Safe, minimal description of the change.
     */
    public function log(string $action, ?Model $subject = null, array $summary = [], ?User $actor = null): AuditLog
    {
        $actor ??= auth()->user();

        return AuditLog::create([
            'user_id' => $actor?->getKey(),
            'action' => $action,
            'auditable_type' => $subject?->getMorphClass(),
            'auditable_id' => $subject?->getKey(),
            'summary' => $this->sanitize($summary),
            'ip_address' => request()->ip(),
        ]);
    }

    /** @param array<string, mixed> $data */
    private function sanitize(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_string($key) && in_array(strtolower($key), self::REDACTED_KEYS, true)) {
                unset($data[$key]);
            } elseif (is_array($value)) {
                $data[$key] = $this->sanitize($value);
            }
        }

        return $data;
    }
}