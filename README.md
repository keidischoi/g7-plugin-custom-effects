# g7-plugin-custom-effects

그누보드7 방문자 화면에 Canvas 기반 눈 또는 비 효과를 추가하는 플러그인입니다.

## 기능

- 눈·비 효과 선택
- 밀도, 속도, 불투명도, 바람과 색상 설정
- 모바일 및 관리자 화면 적용 여부 설정
- `prefers-reduced-motion` 접근성 설정 지원
- 비활성 탭에서 자동 일시정지
- 화면 해상도에 맞춘 입자 수 제한과 고해상도 Canvas 지원

이 기능은 자체 페이지나 비즈니스 데이터를 소유하지 않고 기존 화면을 선택적으로 확장하므로
G7 모듈이 아닌 플러그인으로 구현되어 있습니다. 전역 플러그인 에셋과
`window.G7Config.plugins['g7-plugin-custom-effects']`에 공개된 안전한 설정만 사용하며 코어
파일이나 템플릿을 수정하지 않습니다.

## 요구 사항

- 그누보드7 `>=7.0.0`
- PHP `^8.2`

## 설치

GitHub 저장소에서 설치하거나 플러그인 디렉터리를
`plugins/g7-plugin-custom-effects`에 배치한 다음 실행합니다.

```bash
php artisan plugin:install g7-plugin-custom-effects
php artisan plugin:activate g7-plugin-custom-effects
```

관리자 플러그인 목록에서 **사용자 화면 효과** 설정을 열어 효과를 조절할 수 있습니다. 설정을
저장한 뒤 방문자 페이지를 새로고침하세요.

## 개발

```bash
npm install
npm test
npm run typecheck
npm run build
```

배포물에는 `plugin.json`이 선언한 다음 파일이 포함되어야 합니다.

- `dist/js/plugin.iife.js`
- `dist/css/plugin.css`

## 구조

```text
config/settings/defaults.json              프론트엔드 공개 설정
resources/layouts/admin/plugin_settings.json 관리자 설정 화면
resources/js/                               효과 설정 및 Canvas 엔진
resources/css/effects.css                   화면 Overlay 스타일
plugin.php                                  설정 스키마
plugin.json                                 G7 플러그인 Manifest
```

## 라이선스

MIT
