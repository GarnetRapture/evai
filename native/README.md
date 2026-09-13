# EverSoul PC 네이티브 확장

이 디렉터리는 Windows x86_64·Linux x86_64/arm64용 C++23 이상 네이티브 호스트다. SQLite 대화/기억 저장소와 LiteRT-LM 모델 서빙을 같은 지속 프로세스에서 제공한다. 지원 컴파일러에서는 C++26 모드를 사용한다. 모델을 설정하지 않아도 기존 DB 연산은 사용할 수 있다.

## 빌드

```sh
npm run native:configure
npm run native:build
```

CMake는 SQLite 3.53.4 공식 amalgamation을 SHA3-256으로 검증해 빌드 디렉터리에만 받는다. 저장소에 vendor 파일이나 빌드 산출물을 커밋하지 않는다. 실행 파일은 `native/build/eversoul-native-host` 또는 Windows의 `native/build/eversoul-native-host.exe`다. `--db`를 생략하면 DB는 작업 디렉터리가 아니라 반드시 실행 파일과 같은 디렉터리의 `eversoul-context.sqlite3`로 생성된다.

## 통신 계약

기본 모드는 Chromium·Firefox 계열 확장의 Native Messaging 규격인 4바이트 little-endian 길이 + UTF-8 JSON 프레임이다. 수동 진단은 `--jsonl`을 사용한다.

```sh
native/build/eversoul-native-host --jsonl
```

지원 연산은 `health`, `statistics`, `append_message`, `append_memory`, `sync_messages`, `sync_memories`, `query_context`, `delete_message`, `delete_room`, `clear_all`이다. `sync_*`는 기존 IndexedDB 데이터를 네이티브 저장소에 멱등 배치 반영한다. `health`는 SQLite 버전, 지속 호스트 PID, 실제 EXE·DB·INI 절대 경로와 DB/WAL/SHM별·합산 디스크 바이트, 단일 인스턴스 및 표시 언어를 반환한다. `statistics`는 SQLite가 실제 보유한 룸·메시지·기억 수와 정령별 본문 바이트를 집계한다. 입력 프레임은 최대 8 MiB이고 Native Messaging 응답은 브라우저 호환 한계인 1 MiB를 넘기지 않으며, SQL은 모두 prepared statement로 실행한다. SQLite는 WAL, foreign key, 5초 busy timeout, `synchronous=NORMAL`을 사용한다. 읽기는 WAL 스냅샷을 사용하고 쓰기·삭제만 짧은 `BEGIN IMMEDIATE` 트랜잭션으로 묶는다. 대화 삭제 시 출처가 연결된 파생 기억도 같은 트랜잭션에서 삭제된다.

일반 웹 페이지는 보안상 실행 파일을 직접 시작할 수 없다. 개발 서버의 `/__eversoul/native-context`는 초기 설정에서 입력한 EXE/폴더 절대 경로를 최우선 사용하고, 비어 있으면 `EVERSOUL_NATIVE_HOST`, OS Native Messaging 등록정보, 프로젝트 빌드, 사용자·시스템 표준 설치 위치 순으로 자동 탐색한다. 사용자가 `네이티브 프로그램 연결`을 누르면 개발 서버는 `--jsonl --visible-console` 호스트를 독립 콘솔 창으로 시작해 Vite 종료까지 같은 프로세스를 유지한다. 최초 실제 콘솔 실행은 `1 한국어 / 2 English / 3 简体中文` 선택을 받고 EXE 옆 `eversoul-native-host.ini`에 저장한다. 다음 실행부터는 이 언어를 바로 사용한다. 콘솔은 요청 로그를 쌓지 않고 연결 대기/연결됨, SQLite 정상, PID, EXE·DB·INI 경로, 종료 방법만 고정 표시한다. 콘솔을 닫으면 호스트도 종료되며, Vite 종료·연결 해제 때는 stdin과 프로세스를 닫고 제한 시간 뒤 강제 종료한다. 실행 파일 경로별 OS 단일 인스턴스 잠금으로 중복 호스트를 거부한다. 요청 대기열과 프로토콜 버퍼에는 상한이 있으며 로그 파일은 만들지 않는다. 배포본은 `extension/chromium` 또는 `extension/firefox` 폴더를 브라우저 확장으로 설치하며, 확장의 `connectNative` 지속 포트가 호스트를 유지하고 요청을 순서대로 연결한다. 브라우저가 OS 등록정보에서 호스트를 찾고 프론트는 입력 경로와 실제 `health.executable_path`의 일치를 검사한다. Windows 등록은 `install-host.ps1 -Browser chrome|edge|firefox -ExtensionId <ID> [-ExecutablePath <EXE 또는 폴더>]`, Linux 등록은 `install-host.sh chrome|chromium|edge|firefox <ID> [EXE 또는 폴더]`를 사용한다. 프론트 기본값은 IndexedDB이고 `native_mirror`를 선택하면 대화·기억·삭제를 SQLite에 함께 반영하고 조회를 병합한다. 연결이 끊겨도 일반 대화의 IndexedDB 권위 저장은 계속 작동한다. 단, 네이티브 모드의 전체 초기화와 백업 복원은 양쪽 저장소가 달라지는 일을 막기 위해 먼저 연결을 확인하고, SQLite를 비운 뒤 IndexedDB와 동일한 데이터로 동기화한다.

## 모델 서빙

`third_party/LiteRT-LM`의 실제 소스로 추론 라이브러리를 빌드한다. CMake와 C++23 이상 컴파일러, Bazelisk/Bazel 및 upstream 네이티브 빌드 도구가 필요하다. `EVERSOUL_LITERT_LM_SOURCE_DIR`로 체크아웃 위치를 지정할 수 있다. 코어와 의존성의 소스만 빌드 디렉터리로 복사하고 C API의 `engine.cc`, `conversation.cc`, `error_reporter.cc`를 빌드한다. 원본 체크아웃·Android·TypeScript는 수정하지 않는다. 릴리스 C API DLL을 내려받아 대체하지 않는다. 코어 헤더와 소스는 SHA-256 일치를 확인하며 해당 소스에 포함된 플랫폼 가속기만 함께 배포한다.

`configure_model`, `load_model`, `unload_model`, `model_status`, `start_generation`, `generation_status`, `cancel_generation`, `generate`가 기존 프론트엔드의 JSON 계약을 사용한다. 모델은 `.litertlm` 또는 `.task` 파일이나 해당 파일 하나가 들어 있는 폴더를 지정한다. 폴더에 후보가 여러 개면 `model_file`을 지정해야 한다. GPU 엔진 생성 실패 시 CPU로 시도하고 `active_backend`에는 실제 성공한 백엔드를 반환한다. 일반 GGUF 파일이나 Chrome 내부 모델 파일을 LiteRT-LM 모델로 간주하지 않는다.

시스템 프롬프트, 이전 대화, 최신 사용자 입력, 샘플링 및 JSON Schema 제약을 upstream Conversation API에 전달한다. 생성은 작업 스레드에서 실행되며 폴링·취소·DB 요청을 계속 처리한다. 동시에 실행 가능한 생성은 하나이며 중복 실행은 명시적으로 거부한다. 종료된 요청 8개를 보관하고 누적 응답 본문은 Native Messaging 프레임에 들어가도록 96 KiB로 제한한다. 토큰 수는 실제 prefill/decode 카운터를 사용한다. 모델 설정 저장 실패 시 활성 설정은 유지하고 성공 시 이전 생성·엔진을 종료한 후 새 설정과 상태를 반영한다. `litert-cache`는 설정 파일 옆에 생성한다.

## 확장 없이 브라우저로 접속

```sh
eversoul-native-host --serve --headless
# 기존 배포 화면 경로를 직접 지정하는 경우
eversoul-native-host --serve --headless --web-root /path/to/evai/dist --http-port 47831
```

기본 주소는 `http://127.0.0.1:47831`이다. 네이티브 빌드는 이미 존재하는 `dist`를 실행 파일 옆 `web`으로 복사할 수 있으며 웹 빌드를 실행하지 않는다. `EVERSOUL_WEB_DIST`로 배포 화면 위치를 지정한다. C++ 서버는 HTML에 기존 `window.__EVERSOUL_NATIVE_CONTEXT__.send` 계약을 연결한 뒤 원래 웹 앱을 제공한다. Chrome·Firefox·Whale에서는 이 주소로 같은 앱과 네이티브 모델을 사용할 수 있고, 기존 Chrome Prompt API 선택 경로와 `LanguageModel` 객체는 브라우저 코드가 계속 담당한다. Chrome API가 없는 브라우저에서 Chrome 내장 모델이 제공되는 것은 아니다.

Safari는 Windows·Linux 호스트에서 실행되는 브라우저가 아니므로, 그 호스트의 서비스를 신뢰할 수 있는 HTTPS reverse proxy로 제공하고 Safari에서 해당 주소로 접속한다. 호스트에는 `--public-origin https://사용할호스트명`을 지정하고 proxy는 웹 화면과 `/__eversoul/native-context`를 모두 같은 호스트로 전달해야 한다. C++ 리스너는 loopback에만 바인딩하며 HTTPS 인증서와 proxy 설치는 별도 배포 설정이다. 등록한 origin·Host와 JSON 브리지 헤더를 확인하고 외부 origin에는 CORS를 허용하지 않는다.

Native Messaging 확장 경로와 JSONL 경로도 유지된다. 웹 서버·확장·DB는 같은 프로세스의 단일 모델 상태를 공유한다. IndexedDB는 브라우저와 origin별 저장소이므로 기존 사이트에서 새 로컬 주소로 접속한다고 기존 IndexedDB 데이터가 자동 이동하지 않는다. SQLite 파일·테이블·동기화·삭제 연산 및 기존 백업 계약은 유지한다. `Ctrl+C` 또는 종료 신호로 웹 서빙을 종료한다.
