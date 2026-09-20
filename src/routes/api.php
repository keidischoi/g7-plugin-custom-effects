<?php

use Illuminate\Support\Facades\Route;
use Plugins\Custom\Effects\Http\Controllers\PublicSettingsController;

/*
|--------------------------------------------------------------------------
| Custom Effects API Routes
|--------------------------------------------------------------------------
|
| PluginRouteServiceProvider prefix:
| - URL: api/plugins/custom-effects
| - Name: api.plugins.custom-effects.
|
*/

Route::get('/settings', [PublicSettingsController::class, 'show'])
    ->name('settings');
