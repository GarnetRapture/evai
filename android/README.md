# EverSoul AI Chat for Android

`@evai/android` is an independent React Native application with Android application ID `evai.android`. It uses platform views and a private SQLite database. It is not a WebView of the PC application.

The Android project is currently an implementation in progress. The screens and native bridge are connected in source, but the complete `src` conversation, memory, persona, assets, and settings behavior has not been ported. [ANDROID_TRACKING.md](ANDROID_TRACKING.md) records the remaining acceptance work.

## Native layout

- `src/`: mobile screens, state, and domain adapters.
- Pure persona and reply rules remain owned by the root `src/domains` and are consumed by Metro through `watchFolders`; the Android UI and platform services are separate.
- `android/app/src/main/java/evai/android/`: Android bridge, private SQLite, bundled spirit access, and document picker for GGUF files.
- `android/app/src/main/cpp/`: mobile C++ adapter that owns llama.cpp model and context lifetime, sampling, and cancellation.
- `android/native/llama.cpp`: expected location of the original upstream llama.cpp source. It is absent from this repository and has not been cloned.
- `../data/dataset/`: local source of the spirit JSON assets packaged by Gradle. This directory is ignored by the root repository, so a clean checkout needs an authorized asset provisioning path.

No Google AI, ML, model runtime, Gemini, LiteRT, MediaPipe, or Play services library is used. The Android operating system API and Android build tooling are needed to produce an Android app.

The React Native packages declared in `package.json` have not been installed. A Gradle wrapper, original llama.cpp source snapshot, packaged assets, and an Android build are still required before a runnable APK can be claimed. The project rule currently permits Android source review and does not permit a Gradle build without an explicit instruction.
