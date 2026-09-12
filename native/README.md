# EverSoul PC 네이티브 확장

이 디렉터리는 웹 기본 경로를 대체하지 않는 선택형 C++26 확장이다. 사용자가 설치하면 Windows·Linux에서 SQLite 기반 대화/기억 저장소를 사용할 수 있도록 브라우저 확장과 통신하는 네이티브 호스트를 제공한다.

## 빌드

```sh
npm run native:configure
npm run native:build
npm run native:test
```

CMake는 SQLite 3.53.4 공식 amalgamation을 SHA3-256으로 검증해 빌드 디렉터리에만 받는다. 저장소에 vendor 파일이나 빌드 산출물을 커밋하지 않는다. 실행 파일은 `native/build/eversoul-native-host` 또는 Windows의 `native/build/eversoul-native-host.exe`다. `--db`를 생략하면 DB는 작업 디렉터리가 아니라 반드시 실행 파일과 같은 디렉터리의 `eversoul-context.sqlite3`로 생성된다.

## 통신 계약

기본 모드는 Chromium·Firefox 계열 확장의 Native Messaging 규격인 4바이트 little-endian 길이 + UTF-8 JSON 프레임이다. 수동 진단은 `--jsonl`을 사용한다.

```sh
native/build/eversoul-native-host --jsonl
```

지원 연산은 `health`, `statistics`, `append_message`, `append_memory`, `sync_messages`, `sync_memories`, `query_context`, `delete_message`, `delete_room`, `clear_all`이다. `sync_*`는 기존 IndexedDB 데이터를 네이티브 저장소에 멱등 배치 반영한다. `health`는 SQLite 버전, 지속 호스트 PID, 실제 EXE·DB 절대 경로와 DB/WAL/SHM별·합산 디스크 바이트를 반환한다. `statistics`는 SQLite가 실제 보유한 룸·메시지·기억 수와 정령별 본문 바이트를 집계한다. 입력 프레임은 최대 8 MiB이고 Native Messaging 응답은 브라우저 호환 한계인 1 MiB를 넘기지 않으며, SQL은 모두 prepared statement로 실행한다. SQLite는 WAL, foreign key, 5초 busy timeout, `synchronous=NORMAL`을 사용한다. 대화 삭제 시 출처가 연결된 파생 기억도 같은 트랜잭션에서 삭제된다.

일반 웹 페이지는 보안상 실행 파일을 직접 시작할 수 없다. 개발 서버의 `/__eversoul/native-context`는 초기 설정에서 입력한 EXE/폴더 절대 경로를 최우선 사용하고, 비어 있으면 `EVERSOUL_NATIVE_HOST`, OS Native Messaging 등록정보, 프로젝트 빌드, 사용자·시스템 표준 설치 위치 순으로 자동 탐색한다. 사용자가 `네이티브 프로그램 연결`을 누르면 개발 서버는 `--jsonl` 호스트를 시작해 Vite 종료까지 같은 프로세스를 유지한다. 배포본은 `extension/chromium` 또는 `extension/firefox` 폴더를 브라우저 확장으로 설치하며, 확장의 `connectNative` 지속 포트가 호스트를 유지하고 요청을 순서대로 연결한다. 브라우저가 OS 등록정보에서 호스트를 찾고 프론트는 입력 경로와 실제 `health.executable_path`의 일치를 검사한다. Windows 등록은 `install-host.ps1 -Browser chrome|edge|firefox -ExtensionId <ID> [-ExecutablePath <EXE 또는 폴더>]`, Linux 등록은 `install-host.sh chrome|chromium|edge|firefox <ID> [EXE 또는 폴더]`를 사용한다. 프론트 기본값은 IndexedDB이고 `native_mirror`를 선택하면 대화·기억·삭제를 SQLite에 함께 반영하고 조회를 병합한다. 연결이 끊겨도 일반 대화의 IndexedDB 권위 저장은 계속 작동한다. 단, 네이티브 모드의 전체 초기화와 백업 복원은 양쪽 저장소가 달라지는 일을 막기 위해 먼저 연결을 확인하고, SQLite를 비운 뒤 IndexedDB와 동일한 데이터로 동기화한다.

LiteRT-LM 소스는 저장소 루트의 무시된 `third_party/LiteRT-LM`에 참고용으로 있으며 Apache-2.0 원문과 upstream 이력을 그대로 보존한다. 추론 호스트 결합은 SQLite 저장 호스트와 별도 기능으로 유지해, 저장 확장을 선택했다고 모델 런타임까지 강제하지 않는다.
