# Android 전용 작업 트래킹

이 문서는 `android/`의 구현 상태와 남은 수용 조건을 기록한다. 작업 규칙은 루트 `AGENTS.md`가 소유한다. 기능이 완성되기 전에는 완료 전용 `AI_TRACKING.md`에 기록하지 않는다.

## 목표와 제약

- `main` 브랜치를 유지하면서 `android/`에 모바일 전용 React Native 앱을 만든다.
- npm 패키지는 `@evai/android`, Android 애플리케이션 ID는 `evai.android`다. Android ID에는 `/`를 사용할 수 없다.
- `src`의 사용자 기능을 모바일 화면으로 재구현한다. PC 웹을 감싼 WebView나 브라우저 화면 복제가 아니다.
- 원본 llama.cpp에 모바일 전용 C++ 코드를 연결한다. Google AI/ML 오픈소스, Gemini Nano, LiteRT, MediaPipe, Play services를 사용하지 않는다.
- 정령 인격, 저장된 전체 대화 문맥, 턴 순서, 응답 검증, 독립적인 로컬 저장소 의미를 지킨다.

## 현재 구현

| 영역 | 상태 | 근거 |
| --- | --- | --- |
| 프로젝트 식별자 | 소스 작성, 빌드 전 | `package.json`, `app.json`, `android/app/build.gradle` |
| 모바일 호스트 | 소스 작성, 실행 전 | Android manifest, `MainActivity.kt`, `MainApplication.kt` |
| 데이터 브리지 | 초기 계약 구현, 빌드 전 | `EvaiNativeModule.kt`, `EvaiDatabase.kt`의 12개 저장소 이름, 채팅 인덱스, 메시지·방 원자적 쓰기 |
| 정령 자료 | 로컬 빌드 설정 연결 | Gradle 자산 경로가 `data/dataset`을 참조하며 네이티브 모듈이 JSON을 읽음 |
| llama.cpp 기반 | C++ 어댑터 작성, 빌드 전 | CMake가 `android/native/llama.cpp` 원본을 요구하며 `llama_bridge.cpp`가 모델·컨텍스트 수명과 취소를 소유함 |
| 네이티브 UI | 초기 화면 연결, 기능 동등성 미완성 | `src/App.tsx`가 로비, 정령 목록, 채팅, 스토리, 기억, 저장소, 설정, 안내를 연결함 |
| 공통 순수 규칙 | 소스 연결, 번들 전 | Android 채팅이 루트 `src/domains`의 정령 프롬프트·턴 후크·응답 파서를 사용하고 Metro가 루트 소스를 감시함 |
| 루트 컨벤션·문서·무시 규칙 | 연결됨 | `AGENTS.md`가 이 문서를 지정하고 `README.md`·`README.en.md`가 현재 상태를 가리키며 루트 `.gitignore`가 Android 빌드 산출물을 제외함 |

## 남은 수용 조건

- 로비, 정령 선택·프로필, 채팅, 관계·기억, 스토리, 설정, 저장소, 백업, 모듈, 모델 관리, 안내의 실제 기능을 모바일에 구현한다. 화면만 존재하거나 모델 가져오기·삭제만 되는 상태는 기능 동등성이 아니다.
- `src/domains/chat/service.ts`, `prompt.ts`, `personaTurnHook.ts`, `llm/turn.ts`, `replyEnvelope.ts`의 전체 대화 조립 경로를 보존한다. 현재 Android 채팅에는 관계 장부, 내면, 기억 입력이 빠져 있다.
- `src/shared/storage/schema.ts`의 키 경로, 인덱스, 트랜잭션, 백업·복원·삭제 계약을 Android 저장소에 완성한다.
- 새 체크아웃에서 정령 JSON과 시각 자산을 제공할 경로를 마련한다. 루트 Git은 현재 `data/`를 무시한다.
- 원본 llama.cpp와 선언된 React Native 의존성이 있어야 네이티브 빌드가 가능하다. 이번 작업에는 설치·클론 승인이 없으므로 수행하지 않았다.
- 허용된 Android 소스 검토 범위에서 연결을 검증한다. Gradle 빌드나 기기 실행은 프로젝트의 현재 검증 규칙상 지시가 필요하다.

## 검증 근거

- Android TypeScript 파일에 대한 구문 전용 검사(`tsc --noCheck --noResolve`)가 통과했다. 타입 검사, Metro 번들, Gradle 빌드, 기기 실행은 수행하지 않았다. 소스 연결과 실제 동작은 아직 완성되지 않았다.

## 소유권과 실행 흐름

웹의 `src/App.tsx`는 `src/domains/evertalk`으로 진입한다. `src/domains/chat/service.ts`는 저장된 전체 대화를 읽고 `prompt.ts`와 `llm/turn.ts`를 거쳐 턴을 조립하며, 응답을 검증한 뒤 저장한다. Android는 별도의 모바일 UI와 전용 SQLite를 소유하되 이 동작을 재현해야 한다. C++은 GGUF 모델·컨텍스트·샘플링과 생성을, Kotlin은 플랫폼 저장소·자산·브리지를, React Native는 화면과 상태를 소유한다.
