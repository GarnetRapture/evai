# EverSoul AI Chat build and release

<p align="right"><a href="../README.en.md">← README</a></p>

## Run & Build

You need [Node.js](https://nodejs.org/) and a PC desktop browser. To build the launcher yourself you need a C++ compiler that accepts `-std=c++26`.

- Windows: `pacman -S mingw-w64-ucrt-x86_64-gcc` in an [MSYS2](https://www.msys2.org/) UCRT64 shell
- Linux: GCC 14 or newer (for example `CXX=g++-14`)
- macOS: Homebrew GCC (for example `brew install gcc`, then `CXX=g++-15`)

```bash
npm install          # install dependencies
npm run dev          # Vite dev server (http://localhost:5173)
npm run lint         # oxlint
npm run build        # tsc -b type check + vite build (dist/)
npm run server:build # build server/build/evai-server(.exe)
```

All three OSes build with the same `server/build.sh`; choose the compiler with something like `CXX=g++-14 npm run server:build`. On Windows the script uses `windres` to embed the icon and version info (the `package.json` version, company everlib) into the exe.

`dist/` is only static files, so it can go on any static host. The production address is [ai.everlib.pro](https://ai.everlib.pro/). The File System Access API works only on HTTPS or localhost.

---

How to use the workflows (fork, run Actions, download the package) is in [the README section "Build it yourself with GitHub Actions"](../README.en.md#build-it-yourself-with-github-actions).
