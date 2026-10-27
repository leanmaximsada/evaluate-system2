<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\PasswordResetController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('health', function () {
        DB::select('select 1');

        return response()->json(['status' => 'ok']);
    });

    Route::prefix('auth')->group(function () {
        Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
        Route::post('forgot-password', [PasswordResetController::class, 'forgot'])->middleware('throttle:password-reset');
        Route::post('reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:password-reset');

        Route::middleware(['auth:sanctum', 'active'])->group(function () {
            Route::post('logout', [AuthController::class, 'logout']);
            Route::get('me', [AuthController::class, 'me']);
            Route::put('password', [AuthController::class, 'changePassword']);
        });
    });

    Route::middleware(['auth:sanctum', 'active'])->group(function () {
        Route::apiResource('users', UserController::class)->except('destroy');
        Route::patch('users/{user}/status', [UserController::class, 'updateStatus']);
        Route::post('users/{user}/password-reset', [UserController::class, 'sendPasswordReset'])->middleware('throttle:password-reset');
    });
});