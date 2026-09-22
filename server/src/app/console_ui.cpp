#include "app/console_ui.hpp"

#include "app/server_config.hpp"
#include "platform/executable_directory.hpp"

#include <array>
#include <cstddef>
#include <cstdint>
#include <filesystem>
#include <format>
#include <iostream>
#include <string>
#include <string_view>

namespace evai::server::app {

namespace {

struct ConsoleMessages {
    std::string_view banner;
    std::string_view root_label;
    std::string_view database_label;
    std::string_view database_ready;
    std::string_view database_records;
    std::string_view ollama_label;
    std::string_view ollama_ready;
    std::string_view ollama_unavailable;
    std::string_view serving_label;
    std::string_view serving_ready;
    std::string_view config_label;
    std::string_view close_hint;
    std::string_view failure_label;
    std::string_view browser_label;
    std::string_view browser_opened;
    std::string_view browser_failed;
    std::string_view asset_label;
    std::string_view asset_checking;
    std::string_view asset_downloading;
    std::string_view asset_present;
    std::string_view asset_relocated;
    std::string_view asset_downloaded;
    std::string_view asset_failed;
    std::string_view voice_prompt;
    std::string_view voice_options;
};

constexpr std::array<ConsoleMessages, 3> messages{{
    {
        "EverSoul AI Chat by Nekoi - Server",
        "실행 폴더",
        "데이터베이스",
        "구동 중",
        "저장된 레코드",
        "Ollama",
        "연결됨",
        "연결되지 않음",
        "웹 서빙",
        "서빙 중",
        "설정 파일",
        "이 창을 닫으면 서버가 꺼집니다.",
        "서버 오류",
        "브라우저",
        "기본 브라우저로 열었습니다",
        "기본 브라우저를 열지 못했습니다. 아래 주소를 직접 여세요",
        "에셋",
        "목록 확인 중",
        "내려받는 중",
        "보유",
        "재배치",
        "새로 받음",
        "실패",
        "음성 언어 선택",
        "[1] 한국어    [2] 日本語    [3] 둘 다    [4] 받지 않음",
    },
    {
        "EverSoul AI Chat by Nekoi - Server",
        "Root folder",
        "Database",
        "running",
        "stored records",
        "Ollama",
        "connected",
        "not connected",
        "Web serving",
        "serving",
        "Config file",
        "Closing this window stops the server.",
        "Server error",
        "Browser",
        "opened in the default browser",
        "could not open the default browser; open this address yourself",
        "Assets",
        "checking index",
        "downloading",
        "present",
        "relocated",
        "downloaded",
        "failed",
        "Voice language",
        "[1] Korean    [2] Japanese    [3] Both    [4] Skip",
    },
    {
        "EverSoul AI Chat by Nekoi - Server",
        "运行文件夹",
        "数据库",
        "运行中",
        "已保存记录",
        "Ollama",
        "已连接",
        "未连接",
        "网页服务",
        "服务中",
        "配置文件",
        "关闭此窗口即停止服务器。",
        "服务器错误",
        "浏览器",
        "已在默认浏览器中打开",
        "无法打开默认浏览器，请手动打开以下地址",
        "资源",
        "正在检查清单",
        "正在下载",
        "已有",
        "已归位",
        "新下载",
        "失败",
        "语音语言",
        "[1] 韩语    [2] 日语    [3] 全部    [4] 不下载",
    },
}};

constexpr std::string_view reset = "\x1b[0m";
constexpr std::string_view bright = "\x1b[1;97m";
constexpr std::string_view dim = "\x1b[90m";
constexpr std::string_view accent = "\x1b[38;5;75m";
constexpr std::string_view ready = "\x1b[38;5;78m";
constexpr std::string_view warning = "\x1b[38;5;203m";
constexpr std::string_view clear_screen = "\x1b[2J\x1b[H";
constexpr std::size_t progress_bar_width = 28;

const ConsoleMessages& localized(ConsoleLanguage language)
{
    switch (language) {
        case ConsoleLanguage::english:
            return messages[1];
        case ConsoleLanguage::chinese:
            return messages[2];
        case ConsoleLanguage::korean:
            break;
    }
    return messages[0];
}

}

void prepare_console()
{
    platform::apply_console_identity();
    std::cout << reset << clear_screen << std::flush;
}

void print_banner()
{
    std::cout << '\n'
              << accent << "  ╔══════════════════════════════════════════════════════════════╗\n"
              << "  ║  " << bright << "EverSoul AI Chat by Nekoi" << reset << accent << "  ·  Server " << dim << 'v' << EVAI_SERVER_VERSION << reset << accent << "\n"
              << "  ╚══════════════════════════════════════════════════════════════╝" << reset << "\n\n"
              << std::flush;
}

ConsoleLanguage choose_console_language()
{
    print_banner();
    std::cout << "  " << bright << "[1]" << reset << " 한국어    "
              << bright << "[2]" << reset << " English    "
              << bright << "[3]" << reset << " 简体中文\n\n"
              << accent << "  › " << reset << "언어 선택 / Select language / 请选择语言 : " << std::flush;
    for (;;) {
        std::string answer;
        if (!std::getline(std::cin, answer)) {
            return ConsoleLanguage::korean;
        }
        if (answer == "1") {
            return ConsoleLanguage::korean;
        }
        if (answer == "2") {
            return ConsoleLanguage::english;
        }
        if (answer == "3") {
            return ConsoleLanguage::chinese;
        }
        std::cout << accent << "  › " << reset << "[1-3] : " << std::flush;
    }
}

VoiceLanguage choose_voice_language(ConsoleLanguage language)
{
    const ConsoleMessages& text = localized(language);
    std::cout << '\n' << "  " << text.voice_options << "\n\n"
              << accent << "  › " << reset << text.voice_prompt << " : " << std::flush;
    for (;;) {
        std::string answer;
        if (!std::getline(std::cin, answer)) {
            return VoiceLanguage::korean;
        }
        if (answer == "1") {
            return VoiceLanguage::korean;
        }
        if (answer == "2") {
            return VoiceLanguage::japanese;
        }
        if (answer == "3") {
            return VoiceLanguage::both;
        }
        if (answer == "4") {
            return VoiceLanguage::none;
        }
        std::cout << accent << "  › " << reset << "[1-4] : " << std::flush;
    }
}

void print_asset_check(ConsoleLanguage language)
{
    const ConsoleMessages& text = localized(language);
    std::cout << '\n' << accent << "  ●  " << bright << text.asset_label << reset << "  " << text.asset_checking
              << '\n' << std::flush;
}

void print_asset_progress(ConsoleLanguage language, std::size_t completed, std::size_t total, std::uint64_t bytes,
                          std::uint64_t total_bytes)
{
    const ConsoleMessages& text = localized(language);
    const double ratio = total > 0 ? static_cast<double>(completed) / static_cast<double>(total) : 1.0;
    const std::size_t filled = static_cast<std::size_t>(ratio * static_cast<double>(progress_bar_width) + 0.5);
    std::string bar;
    bar.reserve(progress_bar_width * 3);
    for (std::size_t cell = 0; cell < progress_bar_width; ++cell) {
        bar += cell < filled ? "█" : "░";
    }
    std::cout << '\r' << accent << "  ●  " << bright << text.asset_label << reset << "  " << text.asset_downloading
              << "  " << accent << bar << reset
              << ' ' << std::format("{:5.1f}%", ratio * 100.0)
              << dim << "  ·  " << reset << completed << '/' << total
              << dim << "  ·  " << reset
              << std::format("{:.1f}/{:.1f} MB", static_cast<double>(bytes) / 1048576.0,
                             static_cast<double>(total_bytes) / 1048576.0)
              << "      " << std::flush;
}

void print_asset_summary(ConsoleLanguage language, const AssetStatusReport& report)
{
    const ConsoleMessages& text = localized(language);
    std::cout << '\r' << (report.failed > 0 ? warning : ready) << "  ●  " << bright << text.asset_label << reset << "  "
              << text.asset_present << ' ' << report.present
              << dim << "  ·  " << reset << text.asset_relocated << ' ' << report.relocated
              << dim << "  ·  " << reset << text.asset_downloaded << ' ' << report.downloaded
              << dim << "  ·  " << reset << std::format("{:.1f} MB", static_cast<double>(report.bytes) / 1048576.0);
    if (report.failed > 0) {
        std::cout << dim << "  ·  " << reset << warning << text.asset_failed << ' ' << report.failed << reset;
    }
    std::cout << "        \n";
    if (!report.detail.empty()) {
        std::cout << dim << "     " << report.detail << reset << '\n';
    }
    std::cout << std::flush;
}

void print_status_report(ConsoleLanguage language, const ServerStatusReport& report)
{
    const ConsoleMessages& text = localized(language);
    std::cout << clear_screen;
    print_banner();
    std::cout << ready << "  ●  " << bright << text.database_label << reset << "  " << text.database_ready
              << dim << "  ·  " << reset << text.database_records << ' ' << report.database_record_count << '\n'
              << dim << "     " << report.database_file.string() << reset << "\n\n"
              << (report.ollama_available ? ready : warning) << "  ●  " << bright << text.ollama_label << reset << "  "
              << (report.ollama_available ? text.ollama_ready : text.ollama_unavailable)
              << dim << "  ·  " << reset << report.ollama_base_url << '\n';
    if (!report.ollama_available && !report.ollama_detail.empty()) {
        std::cout << dim << "     " << report.ollama_detail << reset << '\n';
    }
    std::cout << '\n'
              << ready << "  ●  " << bright << text.serving_label << reset << "  " << text.serving_ready
              << dim << "  ·  " << reset << accent << "http://127.0.0.1:" << report.port << "/" << reset << '\n'
              << dim << "     " << report.root_directory.string() << reset << "\n\n"
              << std::flush;
}

void print_config_location(ConsoleLanguage language, const std::filesystem::path& file)
{
    const ConsoleMessages& text = localized(language);
    std::cout << dim << "  " << text.config_label << "  " << file.string() << reset << '\n'
              << dim << "  " << text.close_hint << reset << "\n\n"
              << std::flush;
}

void print_browser_launch(ConsoleLanguage language, std::string_view url, bool opened)
{
    const ConsoleMessages& text = localized(language);
    std::cout << (opened ? ready : warning) << "  ●  " << bright << text.browser_label << reset << "  "
              << (opened ? text.browser_opened : text.browser_failed)
              << dim << "  ·  " << reset << accent << url << reset << "\n\n"
              << std::flush;
}

void print_startup_failure(ConsoleLanguage language, std::string_view detail)
{
    std::cerr << '\n' << warning << "  ●  " << bright << localized(language).failure_label << reset << "  " << detail << "\n\n" << std::flush;
}

}
