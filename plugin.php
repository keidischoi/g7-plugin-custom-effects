<?php

namespace Plugins\Custom\Effects;

use App\Extension\AbstractPlugin;

/**
 * 사용자 화면에 날씨 및 장식 효과를 추가하는 플러그인입니다.
 */
class Plugin extends AbstractPlugin
{
    /**
     * @return array<string, array<string, mixed>>
     */
    public function getSettingsSchema(): array
    {
        return [
            'enabled' => [
                'type' => 'boolean',
                'default' => true,
                'label' => ['ko' => '화면 효과 사용', 'en' => 'Enable effects'],
                'hint' => [
                    'ko' => '방문자 화면에 선택한 날씨 효과를 표시합니다.',
                    'en' => 'Displays the selected weather effect on visitor pages.',
                ],
                'required' => false,
            ],
            'effect' => [
                'type' => 'enum',
                'options' => [
                    'leaves',
                    'snow',
                    'maple_leaves',
                    'coins',
                    'fireflies',
                    'cherry_blossoms',
                    'petals',
                    'stars',
                    'rain',
                    'bubbles',
                    'confetti',
                    'ice_cream',
                    'stars_multicolor',
                    'poop',
                    'alarm_clock',
                    'bills',
                    'cheese',
                    'bouncing_bubbles',
                    'hearts',
                    'sunflowers',
                ],
                'default' => 'snow',
                'label' => ['ko' => '효과 종류', 'en' => 'Effect'],
                'hint' => [
                    'ko' => '날씨 또는 장식 효과를 선택합니다.',
                    'en' => 'Choose a weather or decorative effect.',
                ],
                'required' => true,
            ],
            'intensity' => [
                'type' => 'integer',
                'min' => 10,
                'max' => 200,
                'default' => 100,
                'label' => ['ko' => '효과 밀도 (%)', 'en' => 'Effect density (%)'],
                'hint' => [
                    'ko' => '값이 높을수록 더 많은 입자를 표시합니다.',
                    'en' => 'Higher values display more particles.',
                ],
                'required' => true,
            ],
            'speed' => [
                'type' => 'integer',
                'min' => 25,
                'max' => 300,
                'default' => 100,
                'label' => ['ko' => '낙하 속도 (%)', 'en' => 'Fall speed (%)'],
                'hint' => [
                    'ko' => '기본 속도를 기준으로 낙하 속도를 조절합니다.',
                    'en' => 'Adjusts the falling speed relative to the default.',
                ],
                'required' => true,
            ],
            'opacity' => [
                'type' => 'integer',
                'min' => 10,
                'max' => 100,
                'default' => 75,
                'label' => ['ko' => '불투명도 (%)', 'en' => 'Opacity (%)'],
                'required' => true,
            ],
            'wind' => [
                'type' => 'integer',
                'min' => 0,
                'max' => 100,
                'default' => 0,
                'label' => ['ko' => '바람 세기', 'en' => 'Wind'],
                'hint' => [
                    'ko' => '선택한 방향으로 입자를 미는 세기를 설정합니다.',
                    'en' => 'Controls how strongly particles move in the selected direction.',
                ],
                'required' => true,
            ],
            'wind_direction' => [
                'type' => 'enum',
                'options' => ['none', 'left', 'right', 'random'],
                'default' => 'none',
                'label' => ['ko' => '바람 방향', 'en' => 'Wind direction'],
                'hint' => [
                    'ko' => '바람 없음, 왼쪽, 오른쪽 또는 입자별 무작위를 선택합니다.',
                    'en' => 'Choose no wind, left, right, or a random direction per particle.',
                ],
                'required' => true,
            ],
            'color' => [
                'type' => 'enum',
                'options' => [
                    '#ffffff',
                    '#bae6fd',
                    '#f9a8d4',
                    '#fde047',
                    '#86efac',
                    '#c4b5fd',
                    '#fb923c',
                    '#f87171',
                ],
                'default' => '#ffffff',
                'label' => ['ko' => '입자 색상', 'en' => 'Particle color'],
                'hint' => [
                    'ko' => '미리 준비된 샘플 색상 중 하나를 선택합니다.',
                    'en' => 'Choose one of the preset sample colors.',
                ],
                'required' => true,
            ],
            'schedule_enabled' => [
                'type' => 'boolean',
                'default' => false,
                'label' => ['ko' => '예약 사용', 'en' => 'Enable scheduling'],
                'hint' => [
                    'ko' => '예약을 켜면 아래 일정 중 현재 시각에 해당하는 효과만 표시합니다.',
                    'en' => 'When scheduling is on, only a matching schedule effect is shown.',
                ],
                'required' => false,
            ],
            'schedules' => [
                'type' => 'array',
                'default' => [],
                'label' => ['ko' => '예약 목록', 'en' => 'Schedules'],
                'hint' => [
                    'ko' => '일정을 추가하거나 삭제하고, 일정마다 효과와 세부 설정을 따로 지정합니다.',
                    'en' => 'Add or remove schedules, each with its own effect and detail settings.',
                ],
                'required' => false,
            ],
            'schedule_start_date' => [
                'type' => 'string',
                'default' => '',
                'label' => ['ko' => '시작 날짜', 'en' => 'Start date'],
                'hint' => [
                    'ko' => '비워두면 시작 날짜를 제한하지 않습니다.',
                    'en' => 'Leave empty for no start-date limit.',
                ],
                'required' => false,
            ],
            'schedule_end_date' => [
                'type' => 'string',
                'default' => '',
                'label' => ['ko' => '종료 날짜', 'en' => 'End date'],
                'hint' => [
                    'ko' => '종료 날짜 전체가 예약에 포함됩니다.',
                    'en' => 'The entire end date is included.',
                ],
                'required' => false,
            ],
            'schedule_start_time' => [
                'type' => 'string',
                'default' => '',
                'label' => ['ko' => '매일 시작 시간', 'en' => 'Daily start time'],
                'hint' => [
                    'ko' => '비워두면 하루의 시작부터 적용합니다.',
                    'en' => 'Leave empty to start at the beginning of the day.',
                ],
                'required' => false,
            ],
            'schedule_end_time' => [
                'type' => 'string',
                'default' => '',
                'label' => ['ko' => '매일 종료 시간', 'en' => 'Daily end time'],
                'hint' => [
                    'ko' => '시작 시간보다 이르면 다음 날 종료로 처리합니다.',
                    'en' => 'An earlier end time is treated as ending the next day.',
                ],
                'required' => false,
            ],
            'schedule_days' => [
                'type' => 'enum',
                'options' => ['all', 'weekdays', 'weekends'],
                'default' => 'all',
                'label' => ['ko' => '적용 요일', 'en' => 'Active days'],
                'required' => true,
            ],
            'schedule_timezone' => [
                'type' => 'string',
                'default' => 'Asia/Seoul',
                'label' => ['ko' => '기준 타임존', 'en' => 'Timezone'],
                'hint' => [
                    'ko' => '예약 시간은 환경설정의 기본 시간대로 계산합니다.',
                    'en' => 'Scheduled times use the site default timezone.',
                ],
                'required' => true,
            ],
            'mobile_enabled' => [
                'type' => 'boolean',
                'default' => false,
                'label' => ['ko' => '모바일에서 사용', 'en' => 'Enable on mobile'],
                'hint' => [
                    'ko' => '모바일에서는 배터리 사용을 줄이기 위해 기본적으로 꺼집니다.',
                    'en' => 'Disabled by default on mobile to reduce battery usage.',
                ],
                'required' => false,
            ],
            'admin_enabled' => [
                'type' => 'boolean',
                'default' => false,
                'label' => ['ko' => '관리자 화면에서 사용', 'en' => 'Enable in admin'],
                'hint' => [
                    'ko' => '관리 작업을 방해하지 않도록 기본적으로 꺼집니다.',
                    'en' => 'Disabled by default to avoid distracting from administration.',
                ],
                'required' => false,
            ],
            'respect_reduced_motion' => [
                'type' => 'boolean',
                'default' => true,
                'label' => ['ko' => '동작 줄이기 설정 존중', 'en' => 'Respect reduced motion'],
                'hint' => [
                    'ko' => '운영체제에서 동작 줄이기를 선택한 방문자에게 효과를 표시하지 않습니다.',
                    'en' => 'Hides effects for visitors who prefer reduced motion.',
                ],
                'required' => false,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getConfigValues(): array
    {
        return [
            'enabled' => true,
            'effect' => 'snow',
            'intensity' => 100,
            'speed' => 100,
            'opacity' => 75,
            'wind' => 0,
            'wind_direction' => 'none',
            'color' => '#ffffff',
            'mobile_enabled' => false,
            'admin_enabled' => false,
            'respect_reduced_motion' => true,
            'schedule_enabled' => false,
            'schedules' => [],
            'schedule_start_date' => '',
            'schedule_end_date' => '',
            'schedule_start_time' => '',
            'schedule_end_time' => '',
            'schedule_days' => 'all',
            'schedule_timezone' => 'Asia/Seoul',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getMetadata(): array
    {
        return [
            'author' => 'keidischoi',
            'license' => 'MIT',
            'keywords' => ['effects', 'snow', 'rain', 'canvas', 'cheese', 'coins'],
        ];
    }
}
