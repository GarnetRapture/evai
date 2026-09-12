#include "litert_runtime_loader.h"

#include <array>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <mutex>
#include <string_view>
#include <vector>

#include "litert/c/litert_compiled_model.h"
#include "litert/c/litert_environment.h"
#include "litert/c/litert_model.h"
#include "litert/c/litert_options.h"
#include "litert/c/litert_tensor_buffer.h"

#ifdef _WIN32
#include <windows.h>
#else
#include <dlfcn.h>
#ifdef __linux__
#include <link.h>
#endif
#endif

namespace eversoul::native {
namespace {

#ifdef _WIN32
using ModuleHandle = HMODULE;
#else
using ModuleHandle = void*;
#endif

struct LiteRtFunctions {
    decltype(&::LiteRtCreateEnvironment) createEnvironment = nullptr;
    decltype(&::LiteRtDestroyEnvironment) destroyEnvironment = nullptr;
    decltype(&::LiteRtCreateModelFromBuffer) createModelFromBuffer = nullptr;
    decltype(&::LiteRtDestroyModel) destroyModel = nullptr;
    decltype(&::LiteRtGetNumModelSignatures) getNumModelSignatures = nullptr;
    decltype(&::LiteRtGetModelSignature) getModelSignature = nullptr;
    decltype(&::LiteRtGetSignatureKey) getSignatureKey = nullptr;
    decltype(&::LiteRtGetNumSignatureInputs) getNumSignatureInputs = nullptr;
    decltype(&::LiteRtGetSignatureInputName) getSignatureInputName = nullptr;
    decltype(&::LiteRtGetSignatureInputTensorByIndex) getSignatureInputTensorByIndex = nullptr;
    decltype(&::LiteRtGetNumSignatureOutputs) getNumSignatureOutputs = nullptr;
    decltype(&::LiteRtGetSignatureOutputName) getSignatureOutputName = nullptr;
    decltype(&::LiteRtGetSignatureOutputTensorByIndex) getSignatureOutputTensorByIndex = nullptr;
    decltype(&::LiteRtGetRankedTensorType) getRankedTensorType = nullptr;
    decltype(&::LiteRtCreateOptions) createOptions = nullptr;
    decltype(&::LiteRtDestroyOptions) destroyOptions = nullptr;
    decltype(&::LiteRtSetOptionsHardwareAccelerators) setOptionsHardwareAccelerators = nullptr;
    decltype(&::LiteRtCreateCompiledModel) createCompiledModel = nullptr;
    decltype(&::LiteRtDestroyCompiledModel) destroyCompiledModel = nullptr;
    decltype(&::LiteRtGetCompiledModelInputBufferRequirements) getInputRequirements = nullptr;
    decltype(&::LiteRtGetCompiledModelOutputBufferRequirements) getOutputRequirements = nullptr;
    decltype(&::LiteRtRunCompiledModel) runCompiledModel = nullptr;
    decltype(&::LiteRtCreateManagedTensorBufferFromRequirements) createManagedTensorBuffer = nullptr;
    decltype(&::LiteRtGetTensorBufferPackedSize) getTensorBufferPackedSize = nullptr;
    decltype(&::LiteRtLockTensorBuffer) lockTensorBuffer = nullptr;
    decltype(&::LiteRtUnlockTensorBuffer) unlockTensorBuffer = nullptr;
    decltype(&::LiteRtDestroyTensorBuffer) destroyTensorBuffer = nullptr;
};

std::mutex g_mutex;
ModuleHandle g_module = nullptr;
LiteRtFunctions g_functions;
LiteRtRuntimeStatus g_status;

std::string normalizedArchitecture(std::uint16_t machine) {
    switch (machine) {
        case 0x014c: return "x86";
        case 0x8664: return "x86_64";
        case 0xaa64: return "arm64";
        case 0x01c0:
        case 0x01c4:
        case 0x0028: return "arm";
        case 0x003e: return "x86_64";
        case 0x00b7: return "arm64";
        case 0x0003: return "x86";
        default: return "unknown";
    }
}

std::string binaryArchitecture(const std::filesystem::path& path) {
    std::ifstream input(path, std::ios::binary);
    if (!input) return "unknown";
    std::array<unsigned char, 64> header{};
    input.read(reinterpret_cast<char*>(header.data()), static_cast<std::streamsize>(header.size()));
    if (input.gcount() < 20) return "unknown";
    if (header[0] == 'M' && header[1] == 'Z') {
        const std::uint32_t offset = static_cast<std::uint32_t>(header[0x3c])
            | (static_cast<std::uint32_t>(header[0x3d]) << 8U)
            | (static_cast<std::uint32_t>(header[0x3e]) << 16U)
            | (static_cast<std::uint32_t>(header[0x3f]) << 24U);
        input.clear();
        input.seekg(static_cast<std::streamoff>(offset));
        std::array<unsigned char, 6> pe{};
        input.read(reinterpret_cast<char*>(pe.data()), static_cast<std::streamsize>(pe.size()));
        if (input.gcount() == static_cast<std::streamsize>(pe.size()) && pe[0] == 'P' && pe[1] == 'E') {
            return normalizedArchitecture(static_cast<std::uint16_t>(pe[4] | (pe[5] << 8U)));
        }
    }
    if (header[0] == 0x7f && header[1] == 'E' && header[2] == 'L' && header[3] == 'F') {
        const bool littleEndian = header[5] == 1;
        const std::uint16_t machine = littleEndian
            ? static_cast<std::uint16_t>(header[18] | (header[19] << 8U))
            : static_cast<std::uint16_t>((header[18] << 8U) | header[19]);
        return normalizedArchitecture(machine);
    }
    return "unknown";
}

std::vector<std::filesystem::path> runtimeCandidates(
    const std::filesystem::path& configured,
    const std::filesystem::path& executableDirectory,
    const std::filesystem::path& modelDirectory) {
#ifdef _WIN32
    constexpr std::array<std::string_view, 2> names = {"LiteRt.dll", "libLiteRt.dll"};
#else
    constexpr std::array<std::string_view, 2> names = {"libLiteRt.so", "liblitert.so"};
#endif
    std::vector<std::filesystem::path> candidates;
    const auto appendConfigured = [&](const std::filesystem::path& path) {
        if (path.empty()) return;
        std::error_code error;
        if (std::filesystem::is_directory(path, error)) {
            for (std::string_view name : names) candidates.push_back(path / name);
        }
        else {
            candidates.push_back(path);
        }
    };
    appendConfigured(configured);
    for (const std::filesystem::path& directory : {executableDirectory, modelDirectory}) {
        if (directory.empty()) continue;
        for (std::string_view name : names) candidates.push_back(directory / name);
    }
    for (std::string_view name : names) candidates.emplace_back(name);
    return candidates;
}

#ifdef _WIN32
ModuleHandle openModule(const std::filesystem::path& candidate) {
    if (candidate.has_parent_path()) {
        return LoadLibraryExW(candidate.c_str(), nullptr, LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);
    }
    return LoadLibraryW(candidate.c_str());
}

void closeModule(ModuleHandle module) {
    if (module != nullptr) FreeLibrary(module);
}

void* findSymbol(ModuleHandle module, const char* name) {
    return reinterpret_cast<void*>(GetProcAddress(module, name));
}

std::filesystem::path actualModulePath(ModuleHandle module, const std::filesystem::path&) {
    std::wstring buffer(32768, L'\0');
    const DWORD length = GetModuleFileNameW(module, buffer.data(), static_cast<DWORD>(buffer.size()));
    if (length == 0 || length >= buffer.size()) return {};
    buffer.resize(length);
    return std::filesystem::path(buffer);
}
#else
ModuleHandle openModule(const std::filesystem::path& candidate) {
    return dlopen(candidate.string().c_str(), RTLD_NOW | RTLD_LOCAL);
}

void closeModule(ModuleHandle module) {
    if (module != nullptr) dlclose(module);
}

void* findSymbol(ModuleHandle module, const char* name) {
    return dlsym(module, name);
}

std::filesystem::path actualModulePath(ModuleHandle module, const std::filesystem::path& candidate) {
#ifdef __linux__
    link_map* map = nullptr;
    if (dlinfo(module, RTLD_DI_LINKMAP, &map) == 0 && map != nullptr && map->l_name != nullptr && map->l_name[0] != '\0') {
        return std::filesystem::absolute(map->l_name);
    }
#endif
    std::error_code error;
    if (std::filesystem::exists(candidate, error)) return std::filesystem::absolute(candidate, error);
    return {};
}
#endif

template <typename Function>
bool bind(ModuleHandle module, Function& target, const char* name) {
    target = reinterpret_cast<Function>(findSymbol(module, name));
    return target != nullptr;
}

bool bindFunctions(ModuleHandle module, LiteRtFunctions& functions) {
#define EVERSOUL_BIND(member, symbol) if (!bind(module, functions.member, #symbol)) return false
    EVERSOUL_BIND(createEnvironment, LiteRtCreateEnvironment);
    EVERSOUL_BIND(destroyEnvironment, LiteRtDestroyEnvironment);
    EVERSOUL_BIND(createModelFromBuffer, LiteRtCreateModelFromBuffer);
    EVERSOUL_BIND(destroyModel, LiteRtDestroyModel);
    EVERSOUL_BIND(getNumModelSignatures, LiteRtGetNumModelSignatures);
    EVERSOUL_BIND(getModelSignature, LiteRtGetModelSignature);
    EVERSOUL_BIND(getSignatureKey, LiteRtGetSignatureKey);
    EVERSOUL_BIND(getNumSignatureInputs, LiteRtGetNumSignatureInputs);
    EVERSOUL_BIND(getSignatureInputName, LiteRtGetSignatureInputName);
    EVERSOUL_BIND(getSignatureInputTensorByIndex, LiteRtGetSignatureInputTensorByIndex);
    EVERSOUL_BIND(getNumSignatureOutputs, LiteRtGetNumSignatureOutputs);
    EVERSOUL_BIND(getSignatureOutputName, LiteRtGetSignatureOutputName);
    EVERSOUL_BIND(getSignatureOutputTensorByIndex, LiteRtGetSignatureOutputTensorByIndex);
    EVERSOUL_BIND(getRankedTensorType, LiteRtGetRankedTensorType);
    EVERSOUL_BIND(createOptions, LiteRtCreateOptions);
    EVERSOUL_BIND(destroyOptions, LiteRtDestroyOptions);
    EVERSOUL_BIND(setOptionsHardwareAccelerators, LiteRtSetOptionsHardwareAccelerators);
    EVERSOUL_BIND(createCompiledModel, LiteRtCreateCompiledModel);
    EVERSOUL_BIND(destroyCompiledModel, LiteRtDestroyCompiledModel);
    EVERSOUL_BIND(getInputRequirements, LiteRtGetCompiledModelInputBufferRequirements);
    EVERSOUL_BIND(getOutputRequirements, LiteRtGetCompiledModelOutputBufferRequirements);
    EVERSOUL_BIND(runCompiledModel, LiteRtRunCompiledModel);
    EVERSOUL_BIND(createManagedTensorBuffer, LiteRtCreateManagedTensorBufferFromRequirements);
    EVERSOUL_BIND(getTensorBufferPackedSize, LiteRtGetTensorBufferPackedSize);
    EVERSOUL_BIND(lockTensorBuffer, LiteRtLockTensorBuffer);
    EVERSOUL_BIND(unlockTensorBuffer, LiteRtUnlockTensorBuffer);
    EVERSOUL_BIND(destroyTensorBuffer, LiteRtDestroyTensorBuffer);
#undef EVERSOUL_BIND
    return true;
}

LiteRtFunctions functions() {
    std::scoped_lock lock(g_mutex);
    return g_functions;
}

}

std::string nativeArchitecture() {
#if defined(_M_ARM64) || defined(__aarch64__)
    return "arm64";
#elif defined(_M_X64) || defined(__x86_64__)
    return "x86_64";
#elif defined(_M_IX86) || defined(__i386__)
    return "x86";
#elif defined(_M_ARM) || defined(__arm__)
    return "arm";
#else
    return "unknown";
#endif
}

LiteRtRuntimeStatus loadLiteRtRuntime(
    const std::filesystem::path& configuredPath,
    const std::filesystem::path& executableDirectory,
    const std::filesystem::path& modelDirectory) {
    std::scoped_lock lock(g_mutex);
    if (g_module != nullptr) return g_status;

    std::string lastError = "litert_runtime_not_found";
    for (const std::filesystem::path& candidate : runtimeCandidates(configuredPath, executableDirectory, modelDirectory)) {
        std::error_code error;
        const bool explicitFile = candidate.has_parent_path() && std::filesystem::is_regular_file(candidate, error);
        if (candidate.has_parent_path() && !explicitFile) continue;
        if (explicitFile) {
            const std::string binaryArch = binaryArchitecture(candidate);
            if (binaryArch != "unknown" && binaryArch != nativeArchitecture()) {
                lastError = "litert_runtime_architecture_mismatch:" + binaryArch + ':' + nativeArchitecture();
                continue;
            }
        }
        ModuleHandle module = openModule(candidate);
        if (module == nullptr) {
            lastError = "litert_runtime_load_failed:" + candidate.string();
            continue;
        }
        LiteRtFunctions loaded;
        if (!bindFunctions(module, loaded)) {
            closeModule(module);
            lastError = "litert_runtime_incompatible:" + candidate.string();
            continue;
        }
        g_module = module;
        g_functions = loaded;
        g_status.loaded = true;
        g_status.path = actualModulePath(module, candidate);
        g_status.architecture = explicitFile ? binaryArchitecture(candidate) : nativeArchitecture();
        g_status.error.clear();
        return g_status;
    }
    g_status = LiteRtRuntimeStatus{false, {}, {}, std::move(lastError)};
    return g_status;
}

LiteRtRuntimeStatus liteRtRuntimeStatus() {
    std::scoped_lock lock(g_mutex);
    return g_status;
}

void unloadLiteRtRuntime() {
    std::scoped_lock lock(g_mutex);
    closeModule(g_module);
    g_module = nullptr;
    g_functions = {};
    g_status = {};
}

}

namespace {

eversoul::native::LiteRtFunctions api() {
    return eversoul::native::functions();
}

}

extern "C" LiteRtStatus LiteRtCreateEnvironment(int count, const LiteRtEnvOption* options, LiteRtEnvironment* environment) {
    const auto value = api().createEnvironment;
    return value ? value(count, options, environment) : kLiteRtStatusErrorDynamicLoading;
}
extern "C" void LiteRtDestroyEnvironment(LiteRtEnvironment environment) { if (const auto value = api().destroyEnvironment) value(environment); }
extern "C" LiteRtStatus LiteRtCreateModelFromBuffer(LiteRtEnvironment environment, const void* data, size_t size, LiteRtModel* model) {
    const auto value = api().createModelFromBuffer;
    return value ? value(environment, data, size, model) : kLiteRtStatusErrorDynamicLoading;
}
extern "C" void LiteRtDestroyModel(LiteRtModel model) { if (const auto value = api().destroyModel) value(model); }
extern "C" LiteRtStatus LiteRtGetNumModelSignatures(LiteRtModel model, LiteRtParamIndex* count) { const auto value = api().getNumModelSignatures; return value ? value(model, count) : kLiteRtStatusErrorDynamicLoading; }
extern "C" LiteRtStatus LiteRtGetModelSignature(LiteRtModel model, LiteRtParamIndex index, LiteRtSignature* signature) { const auto value = api().getModelSignature; return value ? value(model, index, signature) : kLiteRtStatusErrorDynamicLoading; }
extern "C" LiteRtStatus LiteRtGetSignatureKey(LiteRtSignature signature, const char** key) { const auto value = api().getSignatureKey; return value ? value(signature, key) : kLiteRtStatusErrorDynamicLoading; }
extern "C" LiteRtStatus LiteRtGetNumSignatureInputs(LiteRtSignature signature, LiteRtParamIndex* count) { const auto value = api().getNumSignatureInputs; return value ? value(signature, count) : kLiteRtStatusErrorDynamicLoading; }
extern "C" LiteRtStatus LiteRtGetSignatureInputName(LiteRtSignature signature, LiteRtParamIndex index, const char** name) { const auto value = api().getSignatureInputName; return value ? value(signature, index, name) : kLiteRtStatusErrorDynamicLoading; }
extern "C" LiteRtStatus LiteRtGetSignatureInputTensorByIndex(LiteRtSignature signature, LiteRtParamIndex index, LiteRtTensor* tensor) { const auto value = api().getSignatureInputTensorByIndex; return value ? value(signature, index, tensor) : kLiteRtStatusErrorDynamicLoading; }
extern "C" LiteRtStatus LiteRtGetNumSignatureOutputs(LiteRtSignature signature, LiteRtParamIndex* count) { const auto value = api().getNumSignatureOutputs; return value ? value(signature, count) : kLiteRtStatusErrorDynamicLoading; }
extern "C" LiteRtStatus LiteRtGetSignatureOutputName(LiteRtSignature signature, LiteRtParamIndex index, const char** name) { const auto value = api().getSignatureOutputName; return value ? value(signature, index, name) : kLiteRtStatusErrorDynamicLoading; }
extern "C" LiteRtStatus LiteRtGetSignatureOutputTensorByIndex(LiteRtSignature signature, LiteRtParamIndex index, LiteRtTensor* tensor) { const auto value = api().getSignatureOutputTensorByIndex; return value ? value(signature, index, tensor) : kLiteRtStatusErrorDynamicLoading; }
extern "C" LiteRtStatus LiteRtGetRankedTensorType(LiteRtTensor tensor, LiteRtRankedTensorType* type) { const auto value = api().getRankedTensorType; return value ? value(tensor, type) : kLiteRtStatusErrorDynamicLoading; }
extern "C" LiteRtStatus LiteRtCreateOptions(LiteRtOptions* options) { const auto value = api().createOptions; return value ? value(options) : kLiteRtStatusErrorDynamicLoading; }
extern "C" void LiteRtDestroyOptions(LiteRtOptions options) { if (const auto value = api().destroyOptions) value(options); }
extern "C" LiteRtStatus LiteRtSetOptionsHardwareAccelerators(LiteRtOptions options, LiteRtHwAcceleratorSet accelerators) { const auto value = api().setOptionsHardwareAccelerators; return value ? value(options, accelerators) : kLiteRtStatusErrorDynamicLoading; }
extern "C" LiteRtStatus LiteRtCreateCompiledModel(LiteRtEnvironment environment, LiteRtModel model, LiteRtOptions options, LiteRtCompiledModel* compiled) { const auto value = api().createCompiledModel; return value ? value(environment, model, options, compiled) : kLiteRtStatusErrorDynamicLoading; }
extern "C" void LiteRtDestroyCompiledModel(LiteRtCompiledModel model) { if (const auto value = api().destroyCompiledModel) value(model); }
extern "C" LiteRtStatus LiteRtGetCompiledModelInputBufferRequirements(LiteRtCompiledModel model, LiteRtParamIndex signature, LiteRtParamIndex input, LiteRtTensorBufferRequirements* requirements) { const auto value = api().getInputRequirements; return value ? value(model, signature, input, requirements) : kLiteRtStatusErrorDynamicLoading; }
extern "C" LiteRtStatus LiteRtGetCompiledModelOutputBufferRequirements(LiteRtCompiledModel model, LiteRtParamIndex signature, LiteRtParamIndex output, LiteRtTensorBufferRequirements* requirements) { const auto value = api().getOutputRequirements; return value ? value(model, signature, output, requirements) : kLiteRtStatusErrorDynamicLoading; }
extern "C" LiteRtStatus LiteRtRunCompiledModel(LiteRtCompiledModel model, LiteRtParamIndex signature, size_t inputCount, LiteRtTensorBuffer* inputs, size_t outputCount, LiteRtTensorBuffer* outputs) { const auto value = api().runCompiledModel; return value ? value(model, signature, inputCount, inputs, outputCount, outputs) : kLiteRtStatusErrorDynamicLoading; }
extern "C" LiteRtStatus LiteRtCreateManagedTensorBufferFromRequirements(LiteRtEnvironment environment, const LiteRtRankedTensorType* type, LiteRtTensorBufferRequirements requirements, LiteRtTensorBuffer* buffer) { const auto value = api().createManagedTensorBuffer; return value ? value(environment, type, requirements, buffer) : kLiteRtStatusErrorDynamicLoading; }
extern "C" LiteRtStatus LiteRtGetTensorBufferPackedSize(LiteRtTensorBuffer buffer, size_t* size) { const auto value = api().getTensorBufferPackedSize; return value ? value(buffer, size) : kLiteRtStatusErrorDynamicLoading; }
extern "C" LiteRtStatus LiteRtLockTensorBuffer(LiteRtTensorBuffer buffer, void** address, LiteRtTensorBufferLockMode mode) { const auto value = api().lockTensorBuffer; return value ? value(buffer, address, mode) : kLiteRtStatusErrorDynamicLoading; }
extern "C" LiteRtStatus LiteRtUnlockTensorBuffer(LiteRtTensorBuffer buffer) { const auto value = api().unlockTensorBuffer; return value ? value(buffer) : kLiteRtStatusErrorDynamicLoading; }
extern "C" void LiteRtDestroyTensorBuffer(LiteRtTensorBuffer buffer) { if (const auto value = api().destroyTensorBuffer) value(buffer); }
