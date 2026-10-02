# Android 전용 작업 트래킹

이 문서는 `android/`의 구현 상태와 남은 수용 조건을 기록한다. 작업 규칙은 루트 `AGENTS.md`가 소유한다. 기능이 완성되기 전에는 완료 전용 `AI_TRACKING.md`에 기록하지 않는다.

## 목표와 제약

- `main` 브랜치를 유지하면서 `android/`에 모바일 전용 React Native 앱을 만든다.
- npm 패키지는 `@evai/android`, Android 애플리케이션 ID는 `evai.android`다. Android ID에는 `/`를 사용할 수 없다.
- `src`의 사용자 기능을 모바일 화면으로 재구현한다. PC 웹을 감싼 WebView나 브라우저 화면 복제가 아니다.
- 도메인 로직은 PC와 같고 UI만 네이티브다. PC 컴포넌트 파일마다 같은 이름의 Android 파일 하나가 대응하며, 각 파일이 자기 StyleSheet를 가진다. 브리지·플랫폼 분기 계층이나 어댑터 컴포넌트를 두지 않는다.
- 원본 llama.cpp에 모바일 전용 C++ 코드를 연결한다. Google AI/ML 오픈소스, Gemini Nano, LiteRT, MediaPipe, Play services를 사용하지 않는다.
- 정령 인격, 저장된 전체 대화 문맥, 턴 순서, 응답 검증, 독립적인 로컬 저장소 의미를 지킨다.

## 현재 구현

| 영역 | 상태 | 근거 |
| --- | --- | --- |
| 프로젝트 식별자 | 소스 완성, 빌드 전 | `package.json`(`@evai/android` 0.0.7, React Native 0.86.3, React 19.2.3), `app.json`, `android/app/build.gradle`(`evai.android`, minSdk 24, compile·target 36, `arm64-v8a`) |
| 모바일 호스트 | 소스 완성, 실행 전 | `MainActivity.kt`, `MainApplication.kt`, `EvaiPackage.kt`가 TurboModule 7개(Storage, Llm, Files, Assets, Audio, Device, Preferences)와 Fabric 뷰 3개(`EvaiVectorView`, `EvaiVideoView`, `EvaiPatternView`)를 등록한다. New Architecture와 Hermes를 쓰고, edge-to-edge 인셋은 `WindowInsetsTracker.kt`가 액티비티 창과 Modal 창 모두에서 추적한다 |
| 저장소 | 소스 완성, 빌드 전 | `storage_jni.cpp`가 PC 로컬 서버의 루트 `server/src/storage` C++ 엔진과 루트 `server/vendor/sqlite3`를 그대로 링크한다. `StorageModule.kt`와 `src/shared/storage`가 루트 `src/shared/storage/schema.ts`의 12개 저장소·키 경로·인덱스·트랜잭션을 같은 계약으로 쓰고, 백업 내보내기·가져오기·폴더 연결은 `FilesModule.kt`, `BackupDirectory.kt`가 맡는다 |
| llama.cpp | 소스 완성, 빌드 전 | CMake `FetchContent`가 llama.cpp 태그 b11236의 커밋 `f1ea206218210afb913ae2f5d2c51faed35915da`를 고정해 받는다. `llama_engine.cpp`, `llama_jni.cpp`, `LlamaEngine.kt`가 GGUF 모델·컨텍스트 수명, 샘플링, 스트리밍, 취소를 소유한다 |
| 모델 확보 | 소스 완성, 빌드 전 | APK 내장 모델 `gemma-3-270m-it-Q8_0.gguf`(Gradle `prepareEvaiBundledModels`가 크기와 SHA-256을 검증한 뒤 자산에 넣음), HTTP(S) GGUF 내려받기(`HttpDownload.kt`), `.gguf` 파일 가져오기, 같은 네트워크 컴퓨터의 Ollama 연결 |
| 에셋 | 소스 완성, 실행 전 | `AssetPreparationGate.tsx`가 PC 서버 `ensure_assets` 흐름(음성 선택 → 확인 → 내려받기 → 요약·재시도·계속)을 재현하고, `AssetLibrary.kt`, `AssetSource.kt`가 Hugging Face 매니페스트 기준으로 받는다. 정령 JSON(`data/dataset`)과 매니페스트는 Gradle `prepareEvaiAssets`가 APK에 넣는다 |
| 도메인 로직 | 소스 완성, 번들 전 | `src/domains`가 PC와 같은 턴 조립 경로(`chat/service.ts` → `prompt.ts`·`personaTurnHook.ts` → `llm/turn.ts` → `engine.ts` → `replyEnvelope.ts` → 저장소)를 쓰고, 순수 모듈은 루트 `src/domains`를 직접 import한다 |
| 네이티브 UI | 소스 완성, 기기 확인 전 | `src/domains/evertalk/components/`에 PC 컴포넌트 57개 중 52개가 같은 이름으로 대응한다. 빠진 5개는 Chrome 전용 3개(`ChromeInstalledModelItem`, `ChromeInstalledModelSection`, `OnDeviceSystemModelItem`), 웹 전용 `LocalServerNotice`, 빈 모듈 `PersonaMaintenanceStatus`다. Android에만 있는 파일은 `AssetPreparationGate`, `RaceBadge` 둘이다. 900dp 미만은 compact, 이상은 expanded 레이아웃이며 PC의 모바일 CSS 구간을 기준으로 한다 |
| 루트 컨벤션·문서·무시 규칙 | 연결됨 | `AGENTS.md`가 이 문서를 지정하고 `README.md`·`README.en.md`가 현재 상태를 가리키며 루트 `.gitignore`가 Android 빌드 산출물을 제외함 |

## 남은 수용 조건

- Gradle 빌드와 기기 실행으로 동작을 확인한다. 대상은 `EvaiSpec` 코드젠 산출물, Metro 번들, llama.cpp 컴파일과 생성 속도, Modal 안의 키보드 인셋, 기억 그래프 제스처(핀치, 빈 곳 끌기, 노드 끌기), 스토리 영상 탐색·음소거, `EvaiPatternView` 타일 렌더링, `EvaiVectorView` 흐르는 점선이다. 프로젝트 규칙상 npm 설치, Gradle 빌드, 기기 실행은 지시가 있어야 하므로 수행하지 않았다.
- 빌드 환경에 정령 JSON(`data/dataset`)과 에셋 매니페스트(`data/manifest.txt`)가 있어야 Gradle `prepareEvaiAssets`가 통과한다. 루트 Git은 `data/`를 무시한다.
- llama.cpp를 커밋 해시로 고정했기 때문에 얕은 클론을 쓸 수 없고, 첫 CMake 구성 때 llama.cpp 저장소 전체를 받는다.

## 검증 근거

- RN 0.86 타입 정의로 `src` 전체를 `strict`, `noUnusedLocals`, `noUnusedParameters` 조건에서 타입 검사했고 오류 0건이다.
- 앱 진입점에서 실제로 실행되는 import 경로를 따라간 결과 파일 203개(그중 루트 `src` 파일 68개)가 묶이며, 그 안의 DOM API 참조는 모두 `typeof document` 분기 뒤에 있거나 Android 실행 경로에서 호출되지 않는다.
- PC 컴포넌트와 Android 컴포넌트의 라벨·이벤트 핸들러·컨트롤러 필드 사용을 대조했고, 남은 차이는 웹·Chrome 전용 기능(브라우저·WebGPU 정보, Chrome 모델 폴더 연결, 로컬 서버 안내)과 플랫폼 입력 방식(포인터 이벤트 → 터치 제스처)뿐이다.
- Kotlin·C++ 변경은 소스로 검토했다. `ExtraWindowEventListener`와 Modal 창 생성 순서는 React Native 0.86.3 원본(`ReactContext.java`, `ReactModalHostView.kt`)과 대조했다.
- Gradle 빌드, Metro 번들, 기기 실행은 수행하지 않았다.

## 소유권과 실행 흐름

웹의 `src/App.tsx`는 `src/domains/evertalk`으로 진입한다. `src/domains/chat/service.ts`는 저장된 전체 대화를 읽고 `prompt.ts`와 `llm/turn.ts`를 거쳐 턴을 조립하며, 응답을 검증한 뒤 저장한다. Android의 `App.tsx`는 `AssetPreparationGate`로 에셋을 준비한 뒤 `EverTalkApp`을 띄우고, `useEverTalkController`가 PC 컨트롤러와 같은 상태와 동작을 제공한다. Android 채팅 서비스는 PC와 같은 대화 모듈(관계 장부, 내면, 기억, 경쟁 문맥, 턴 후크, 응답 봉투)로 같은 순서의 턴을 만들고 전용 SQLite에 저장한다. C++은 GGUF 모델·컨텍스트·샘플링과 생성, 저장소 엔진을, Kotlin은 플랫폼 저장소·자산·파일·미디어·인셋과 네이티브 뷰를, React Native는 화면과 상태를 소유한다.
