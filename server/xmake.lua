set_project("evai-server")
set_xmakever("3.0.0")
set_languages("c++26", "c17")
set_warnings("allextra")
set_encodings("utf-8")
add_rules("mode.release")

local sqlite_defines = {
    "SQLITE_DQS=0",
    "SQLITE_THREADSAFE=1",
    "SQLITE_DEFAULT_MEMSTATUS=0",
    "SQLITE_DEFAULT_WAL_SYNCHRONOUS=1",
    "SQLITE_LIKE_DOESNT_MATCH_BLOBS",
    "SQLITE_MAX_EXPR_DEPTH=0",
    "SQLITE_OMIT_DEPRECATED",
    "SQLITE_OMIT_LOAD_EXTENSION",
    "SQLITE_OMIT_SHARED_CACHE",
    "SQLITE_USE_ALLOCA",
    "SQLITE_ENABLE_JSON1",
    "SQLITE_ENABLE_MATH_FUNCTIONS",
}

function package_version()
    import("core.base.json")
    return json.loadfile(path.join(os.scriptdir(), "..", "package.json")).version
end

function generate_version_header(target)
    import("core.base.json")
    local version = json.loadfile(path.join(os.scriptdir(), "..", "package.json")).version
    local major, minor, patch = version:match("^(%d+)%.(%d+)%.(%d+)$")
    if not major then
        raise("package.json version is not MAJOR.MINOR.PATCH: " .. tostring(version))
    end
    local header_directory = path.join(target:autogendir(), "version")
    os.mkdir(header_directory)
    io.writefile(path.join(header_directory, "evai_server_version.h"), format(
        "#define EVAI_VERSION_MAJOR %s\n#define EVAI_VERSION_MINOR %s\n#define EVAI_VERSION_PATCH %s\n#define EVAI_VERSION_TEXT \"%s\"\n",
        major, minor, patch, version))
    target:add("defines", format("EVAI_SERVER_VERSION=\"%s\"", version))
    target:add("includedirs", header_directory)
    target:add("includedirs", path.join(os.scriptdir(), "..", "public"))
end

function create_database(target)
    local database_directory = path.join(target:targetdir(), "evai-database")
    os.mkdir(database_directory)
    local database_file = path.join(database_directory, "evai.sqlite3")
    os.tryrm(database_file)
    os.tryrm(database_file .. "-wal")
    os.tryrm(database_file .. "-shm")
    os.iorunv(target:targetfile(), {"--create-database", database_file})
    print("database: " .. database_file)
end

task("stage")
    set_category("plugin")
    set_menu({
        usage = "xmake stage",
        description = "Copy the built server binary and its database next to a web bundle",
        options = {{"o", "output", "kv", "dist", "output directory"}},
    })
    on_run(function ()
        import("core.base.option")
        import("core.project.config")
        import("core.project.project")
        config.load()
        local target = project.target("evai-server")
        local output = option.get("output")
        os.mkdir(output)
        os.cp(target:targetfile(), output)
        os.cp(path.join(target:targetdir(), "evai-database"), output)
        print("staged: " .. path.join(output, path.filename(target:targetfile())))
    end)

target("evai-server")
    set_kind("binary")
    add_includedirs("src", "vendor/sqlite3")
    add_files("src/**.cpp")
    add_files("vendor/sqlite3/sqlite3.c", {defines = sqlite_defines, warnings = "none"})
    on_load(generate_version_header)
    after_build(create_database)

    if is_plat("windows", "mingw") then
        add_files("resources/evai_server.rc")
        add_syslinks("ws2_32", "user32")
    else
        add_syslinks("pthread", "dl", "m")
    end

    if is_plat("mingw") then
        add_ldflags("-static", {force = true})
    end
