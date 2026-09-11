# g7-plugin-custom-effects

그누보드7 방문자 화면에 Canvas 기반 날씨 및 장식 효과를 추가하는 플러그인입니다.

## 기능

- 눈·비·낙엽·별·여러 색 별·하트·꽃잎·색종이·비눗방울·서로 충돌하며 튕기는 비눗방울·반딧불·치즈·응가·아이스크림·지폐·동전·자명종·단풍잎 효과 선택
- 응가가 서로 부딪히면 반짝이며 커짐
- 치즈가 서로 부딪히면 폭파해서 사라짐
- 여러 색 별이 서로 부딪히면 불꽃놀이처럼 사방으로 불꽃이 튐
- 눈·낙엽·단풍잎·꽃잎이 페이지 바닥에 조금씩 겹쳐 쌓임
- 비가 페이지 하단에서 튕김
- 사용자 헤더에서 클릭 한 번으로 효과 켜기·끄기
- 시작·종료 날짜와 매일 시간대 예약을 여러 개 추가·삭제
- 예약마다 효과 종류와 일~토 요일을 개별 선택
- 예약 시간은 환경설정의 기본 시간대 사용
- 밀도, 속도, 불투명도, 바람 세기·좌우·무작위 방향과 샘플 색상 설정
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

방문자는 검색 영역과 다크테마 아이콘 사이의 효과 버튼으로 즉시 켜고 끌 수 있습니다. 선택값은
브라우저에 저장되며 다른 탭에도 동기화됩니다. 다른 레이아웃이나 확장에서 같은 동작을 호출하려면
G7 프론트엔드 액션 이벤트를 사용합니다.

```js
window.G7Core.dispatch({
    handler: 'g7-plugin-custom-effects.toggle',
});
```

예약을 사용하면 현재 시각에 맞는 첫 번째 일정의 효과가 표시됩니다. 일정마다 효과 종류와
요일을 따로 지정할 수 있고, 시각은 환경설정의 기본 시간대로 계산합니다. 예약이 켜져 있어도
일정이 없으면 기본 효과가 표시됩니다. 예약 범위 안에서만 사용자의 개별 ON/OFF 선택이 반영됩니다.
종료 시간이 시작 시간보다 이르면 자정을 넘는 예약으로 처리합니다. 예를 들어 `22:00`~`06:00`은
밤 10시부터 다음 날 오전 6시까지 적용됩니다.

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
