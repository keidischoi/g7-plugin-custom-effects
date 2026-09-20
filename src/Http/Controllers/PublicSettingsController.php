<?php

<<<<<<< HEAD
namespace Plugins\Custom\Effects\Http\Controllers;
=======
namespace Plugins\G7\Plugin\Custom\Effects\Http\Controllers;
>>>>>>> c296cf2d90e83e047cf94ead1b1c993fb02b9ad7

use App\Helpers\ResponseHelper;
use App\Services\PluginSettingsService;
use Illuminate\Http\JsonResponse;

/**
 * 방문자 화면에 이미 노출되는 플러그인 설정만 돌려줍니다.
 */
class PublicSettingsController
{
<<<<<<< HEAD
    private const IDENTIFIER = 'custom-effects';
=======
    private const IDENTIFIER = 'g7-plugin-custom-effects';
>>>>>>> c296cf2d90e83e047cf94ead1b1c993fb02b9ad7

    public function __construct(
        private PluginSettingsService $pluginSettings,
    ) {}

    public function show(): JsonResponse
    {
        $settings = [];

        if (method_exists($this->pluginSettings, 'getAllActiveSettings')) {
            $active = $this->pluginSettings->getAllActiveSettings();
            $settings = is_array($active[self::IDENTIFIER] ?? null)
                ? $active[self::IDENTIFIER]
                : [];
        } else {
            $loaded = $this->pluginSettings->get(self::IDENTIFIER);
            $settings = is_array($loaded) ? $loaded : [];
        }

        return ResponseHelper::success('common.success', $settings);
    }
}
