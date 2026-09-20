<?php

use Illuminate\Support\Facades\Route;
<<<<<<< HEAD
use Plugins\Custom\Effects\Http\Controllers\PublicSettingsController;
=======
use Plugins\G7\Plugin\Custom\Effects\Http\Controllers\PublicSettingsController;
>>>>>>> c296cf2d90e83e047cf94ead1b1c993fb02b9ad7

/*
|--------------------------------------------------------------------------
| Custom Effects API Routes
|--------------------------------------------------------------------------
|
| PluginRouteServiceProvider prefix:
<<<<<<< HEAD
| - URL: api/plugins/custom-effects
| - Name: api.plugins.custom-effects.
=======
| - URL: api/plugins/g7-plugin-custom-effects
| - Name: api.plugins.g7-plugin-custom-effects.
>>>>>>> c296cf2d90e83e047cf94ead1b1c993fb02b9ad7
|
*/

Route::get('/settings', [PublicSettingsController::class, 'show'])
    ->name('settings');
