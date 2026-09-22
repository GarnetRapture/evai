# EverSoul AI Chat 빌드와 배포

<p align="right"><a href="../README.md">← README</a></p>

## 실행 및 빌드

필요한 것은 [Node.js](https://nodejs.org/)와 PC 데스크톱 브라우저입니다. 실행기를 직접 빌드하려면 `-std=c++26`을 받는 C++ 컴파일러가 필요합니다.

- 윈도우: [MSYS2](https://www.msys2.org/) UCRT64 셸에서 `pacman -S mingw-w64-ucrt-x86_64-gcc`
- 리눅스: GCC 14 이상 (예: `CXX=g++-14`)
- macOS: Homebrew GCC (예: `brew install gcc` 후 `CXX=g++-15`)

```bash
npm install          # 의존성 설치
npm run dev          # Vite 개발 서버 (http://localhost:5173)
npm run lint         # oxlint 검사
npm run build        # tsc -b 타입 검사 + vite build (dist/)
npm run server:build # server/build/evai-server(.exe) 빌드
```

세 OS 모두 같은 `server/build.sh`로 빌드하고, 컴파일러는 `CXX=g++-14 npm run server:build`처럼 지정합니다. 윈도우에서는 이 스크립트가 `windres`로 아이콘과 버전 정보(`package.json`의 버전, 제작사 everlib)를 exe에 넣습니다.

`dist/`는 정적 파일뿐이라 어떤 정적 호스팅에도 올릴 수 있습니다. 0.0.6부터는 공식 웹 서비스를 운영하지 않고 로컬 서버만 제공합니다. File System Access API는 HTTPS나 localhost에서만 동작합니다.

---

워크플로 사용 방법(포크 → Actions 실행 → 결과물 내려받기)은 [README의 "GitHub Actions로 직접 빌드하기"](../README.md#github-actions로-직접-빌드하기)에 있습니다.
