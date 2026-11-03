<?php

namespace App\Services;

use App\Models\Event;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ResultExporter
{
    private const COLUMNS = ['Rank', 'Number', 'Participant', 'Team', 'Status', 'Score', 'Tie', 'Judges assigned', 'Evaluations submitted', 'Complete'];

    /** @param list<array<string, mixed>> $rows */
    public function csv(Event $event, array $rows, string $publicationStatus): StreamedResponse
    {
        $code = preg_replace('/[^A-Za-z0-9_-]/', '', $event->code) ?: 'event';

        return response()->streamDownload(function () use ($event, $rows, $publicationStatus) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM, so Excel reads Khmer names as UTF-8

            $this->put($out, ['Event', $event->name]);
            $this->put($out, ['Code', $event->code]);
            $this->put($out, ['Event status', $event->status->value]);
            $this->put($out, ['Publication', $publicationStatus]);
            $this->put($out, ['Exported at', now()->toIso8601String()]);
            $this->put($out, []);
            $this->put($out, self::COLUMNS);

            foreach ($rows as $row) {
                $this->put($out, [
                    $row['rank'] ?? '',
                    $row['number'],
                    $row['name'],
                    $row['team_name'],
                    $row['participant_status'],
                    $row['aggregate_score'],
                    $row['is_tied'] ? 'Yes' : 'No',
                    $row['judges_assigned'],
                    $row['evaluations_submitted'],
                    $row['is_complete'] ? 'Yes' : 'No',
                ]);
            }

            fclose($out);
        }, "results-{$code}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** Stops spreadsheet programs from running a cell as a formula. */
    public function safe(?string $value): string
    {
        $value ??= '';

        return $value !== '' && preg_match('/^[=+\-@\t\r]/', $value) === 1 ? "'".$value : $value;
    }

    /** @param resource $out */
    private function put($out, array $fields): void
    {
        $cells = array_map(fn ($v) => is_string($v) ? $this->safe($v) : $v, $fields);
        // The empty escape character is explicit, so PHP 8.4+ raises no deprecation.
        fputcsv($out, $cells, ',', '"', '');
    }
}