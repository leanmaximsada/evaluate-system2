<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /** Makes a request look like it comes from the Next.js SPA, so Sanctum starts a session. */
   protected function spa(): static
{
    config(['sanctum.stateful' => ['localhost:3000']]);

    return $this->withHeaders([
        'Origin' => 'http://localhost:3000',
        'Referer' => 'http://localhost:3000/',
    ]);
}
}