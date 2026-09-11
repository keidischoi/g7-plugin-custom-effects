<?php

use Illuminate\Support\Facades\Route;
use Plugins\G7\Plugin\Custom\Effects\Http\Controllers\PublicSettingsController;

/*
|--------------------------------------------------------------------------
| Custom Effects API Routes
|--------------------------------------------------------------------------
|
| PluginRouteServiceProvider prefix:
| - URL: api/plugins/g7-plugin-custom-effects
| - Name: api.plugins.g7-plugin-custom-effects.
|
*/

Route::get('/settings', [PublicSettingsController::class, 'show'])
    ->name('settings');
