#include "app/console_ui.hpp"

#include "app/server_config.hpp"
#include "platform/executable_directory.hpp"

#include <array>
#include <cstdint>
#include <filesystem>
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
    },
}};

constexpr std::string_view reset = "\x1b[0m";
constexpr std::string_view bright = "\x1b[1;97m";
constexpr std::string_view dim = "\x1b[90m";
constexpr std::string_view accent = "\x1b[38;5;75m";
constexpr std::string_view ready = "\x1b[38;5;78m";
constexpr std::string_view warning = "\x1b[38;5;203m";
constexpr std::string_view clear_screen = "\x1b[2J\x1b[H";

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
