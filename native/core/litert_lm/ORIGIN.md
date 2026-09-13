LiteRT-LM: https://github.com/google-ai-edge/LiteRT-LM

Local source revision: `a0ac1c51a2b9e0d2c059793d41c91d0acf5d8cc7`.
The three C API headers are copied verbatim from `third_party/LiteRT-LM/c`.
Their SHA-256 hashes must match that checkout at CMake configuration time.
The Apache-2.0 license and each header's copyright notice are retained.

`StageLiteRtCore.cmake` stages native core sources and build dependencies only.
The C API library compiles `engine.cc`, `conversation.cc`, `error_reporter.cc`
and their upstream engine/conversation/tokenizer/schema dependency closure.
Embedding API, experimental API, language bindings, example applications and
tests are not part of the selected binary target. The user's upstream checkout
is never patched. Platform accelerator libraries come from the same checkout.
