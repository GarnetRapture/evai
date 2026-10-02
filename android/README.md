# EverSoul AI Chat for Android

`@evai/android` is an independent React Native 0.86 application (New Architecture, Hermes) with Android application ID `evai.android`. It renders native views, keeps its data in a private SQLite database, and runs GGUF models on the device with llama.cpp. It is not a WebView of the PC application.

The source now covers every PC screen. Each PC component in `src/domains/evertalk/components` has an Android file with the same name and the same controller logic, and only the UI is rebuilt natively for phone and tablet widths. The build and on-device behavior have not been verified yet; [ANDROID_TRACKING.md](ANDROID_TRACKING.md) records the implementation state, the verification evidence, and the remaining acceptance work.

## Native layout

- `src/App.tsx`: prepares the downloaded assets with `AssetPreparationGate`, then mounts `EverTalkApp`.
- `src/domains/`: the Android domain layer. Chat turns are assembled through the same path as the PC (`chat/service.ts`, `prompt.ts`, `personaTurnHook.ts`, `llm/turn.ts`, `replyEnvelope.ts`), and pure modules are imported directly from the root `src/domains`.
- `src/domains/evertalk/components/`: the native screens, one file per PC component, each with its own StyleSheet.
- `src/shared/`: layout and window insets, icons, colors, vector shapes, gestures, preferences, storage, and the TurboModule and Fabric specs in `native/specs`.
- `android/app/src/main/java/evai/android/`: TurboModules for storage, llama.cpp generation, files and backups, assets, audio, device information and preferences, plus the `EvaiVectorView`, `EvaiVideoView` and `EvaiPatternView` native views.
- `android/app/src/main/cpp/`: JNI for the storage engine shared with the PC local server and for the llama.cpp engine that owns model and context lifetime, sampling, streaming and cancellation. CMake fetches llama.cpp pinned to commit `f1ea206218210afb913ae2f5d2c51faed35915da` (tag b11236).
- `src/domains/llm/llamaCpp/bundledModels.json`: the small GGUF model packaged inside the APK. Gradle downloads it and checks its size and SHA-256 before the build. Larger models are downloaded over HTTP(S), imported from a `.gguf` file, or served by Ollama on a computer in the same network.
- `../data/dataset/` and `../data/manifest.txt`: the spirit JSON and the asset manifest packaged by Gradle. The root repository ignores `data/`, so the build environment must provide them.

No Google AI, ML, model runtime, Gemini, LiteRT, MediaPipe, or Play services library is used. The Android operating system API and Android build tooling are needed to produce an Android app.

The React Native packages declared in `package.json` have not been installed, and no Gradle build, Metro bundle, or device run has been performed. The project rule permits Android source review and does not permit installs or a Gradle build without an explicit instruction.
