<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\PasswordResetController;
use App\Http\Controllers\Api\V1\SettingsController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\EventController;
use App\Http\Controllers\Api\V1\EventJudgeController;
use App\Http\Controllers\Api\V1\ParticipantController;
use App\Http\Controllers\Api\V1\EvaluationFormController;
use App\Http\Controllers\Api\V1\FormCriterionController;
use App\Http\Controllers\Api\V1\FormVersionController;
use App\Http\Controllers\Api\V1\ResultController;
use App\Http\Controllers\Api\V1\PublicResultController;
use App\Http\Controllers\Api\V1\JudgeController;

Route::prefix('v1')->group(function () {
    Route::get('health', function () {
        DB::select('select 1');

        return response()->json(['status' => 'ok']);
    });

    Route::get('public/settings', [SettingsController::class, 'publicShow'])->middleware('throttle:60,1');
    Route::get('public/events/{eventCode}/results', [PublicResultController::class, 'show'])
    ->where('eventCode', '[A-Za-z0-9_-]{2,50}')
    ->middleware('throttle:public-results');

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
        Route::middleware(['judge', 'throttle:judge'])->prefix('judge')->scopeBindings()->group(function () {
            Route::get('events', [JudgeController::class, 'events']);
            Route::get('events/{event}', [JudgeController::class, 'show']);
            Route::get('events/{event}/participants/{participant}', [JudgeController::class, 'participant']);
            Route::put('events/{event}/participants/{participant}/draft', [JudgeController::class, 'saveDraft']);
            Route::post('events/{event}/participants/{participant}/submit', [JudgeController::class, 'submit']);
        });

        Route::middleware('can:results.view')->group(function () {
            Route::get('events/{event}/results', [ResultController::class, 'index']);
            Route::get('events/{event}/results/publications', [ResultController::class, 'publications']);
        });
        Route::get('events/{event}/results/export', [ResultController::class, 'export'])->middleware('can:results.export');
        Route::middleware('can:results.publish')->group(function () {
            Route::post('events/{event}/results/recalculate', [ResultController::class, 'recalculate']);
            Route::post('events/{event}/results/publish', [ResultController::class, 'publish']);
        });
        Route::post('events/{event}/results/unpublish', [ResultController::class, 'unpublish'])->middleware('can:results.unpublish');
        Route::get('events/{event}/results/{participant}', [ResultController::class, 'show'])
            ->scopeBindings()->middleware('can:results.view');

        Route::middleware('can:events.manage')->group(function () {
            Route::apiResource('events', EventController::class)->except('destroy');
            Route::patch('events/{event}/status', [EventController::class, 'updateStatus']);
            Route::put('events/{event}/form', [EventController::class, 'assignForm']);
            Route::delete('events/{event}/form', [EventController::class, 'clearForm']);

        Route::middleware('can:forms.manage')->prefix('evaluation-forms')->group(function () {
            Route::get('/', [EvaluationFormController::class, 'index']);
            Route::post('/', [EvaluationFormController::class, 'store']);

            Route::scopeBindings()->group(function () {
                Route::get('{form}', [EvaluationFormController::class, 'show']);
                Route::put('{form}', [EvaluationFormController::class, 'update']);
                Route::patch('{form}/status', [EvaluationFormController::class, 'updateStatus']);

                Route::post('{form}/versions', [FormVersionController::class, 'store']);
                Route::get('{form}/versions/{version}', [FormVersionController::class, 'show']);
                Route::put('{form}/versions/{version}', [FormVersionController::class, 'update']);
                Route::post('{form}/versions/{version}/publish', [FormVersionController::class, 'publish']);

                Route::post('{form}/versions/{version}/criteria', [FormCriterionController::class, 'store']);
                Route::put('{form}/versions/{version}/criteria/order', [FormCriterionController::class, 'reorder']);
                Route::put('{form}/versions/{version}/criteria/{criterion}', [FormCriterionController::class, 'update']);
                Route::delete('{form}/versions/{version}/criteria/{criterion}', [FormCriterionController::class, 'destroy']);
            });
        });

            Route::scopeBindings()->group(function () {

                Route::get('events/{event}/participants', [ParticipantController::class, 'index']);
                Route::post('events/{event}/participants', [ParticipantController::class, 'store']);
                Route::put('events/{event}/participants/order', [ParticipantController::class, 'reorder']);
                Route::put('events/{event}/participants/{participant}', [ParticipantController::class, 'update']);
                Route::delete('events/{event}/participants/{participant}', [ParticipantController::class, 'destroy']);
            });
        });

        Route::middleware('can:judges.assign')->group(function () {
            Route::get('events/{event}/judges', [EventJudgeController::class, 'index']);
            Route::get('events/{event}/judge-candidates', [EventJudgeController::class, 'candidates']);
            Route::post('events/{event}/judges', [EventJudgeController::class, 'store']);
            Route::delete('events/{event}/judges/{user}', [EventJudgeController::class, 'destroy']);
        });
        Route::get('dashboard', DashboardController::class);

        Route::apiResource('users', UserController::class)->except('destroy');
        Route::patch('users/{user}/status', [UserController::class, 'updateStatus']);
        Route::post('users/{user}/password-reset', [UserController::class, 'sendPasswordReset'])->middleware('throttle:password-reset');

        Route::get('settings', [SettingsController::class, 'show']);
        Route::put('settings', [SettingsController::class, 'update']);
    });

    
});