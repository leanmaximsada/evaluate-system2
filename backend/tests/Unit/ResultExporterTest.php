<?php

namespace Tests\Unit;

use App\Services\ResultExporter;
use PHPUnit\Framework\TestCase;

class ResultExporterTest extends TestCase
{
    public function test_formula_prefixes_are_neutralised(): void
    {
        $exporter = new ResultExporter();

        foreach (['=1+1', '+1', '-1', '@SUM(A1)', "\tcmd", "\rcmd"] as $value) {
            $this->assertSame("'".$value, $exporter->safe($value), json_encode($value));
        }
    }

    public function test_normal_text_is_untouched(): void
    {
        $exporter = new ResultExporter();

        $this->assertSame('Alice', $exporter->safe('Alice'));
        $this->assertSame('សុខា', $exporter->safe('សុខា'));
        $this->assertSame('90.00', $exporter->safe('90.00'));
        $this->assertSame('a=b', $exporter->safe('a=b'));
        $this->assertSame('', $exporter->safe(''));
        $this->assertSame('', $exporter->safe(null));
    }
}