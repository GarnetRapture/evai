import { LOCAL_SERVER_DEFAULT_URL } from '../../shared/host';
import { OLLAMA_DEFAULT_NETWORK_HOST } from './constants';
import type { OllamaCommandGuideInput, OllamaCommandShell, OllamaCommandStep } from './types';

const WINDOWS_PLATFORM_PATTERN = /^win/iu;
const MACOS_PLATFORM_PATTERN = /^mac/iu;
const POWERSHELL_SINGLE_QUOTE_PATTERN = /'/gu;
const POSIX_SINGLE_QUOTE_PATTERN = /'/gu;

function quotePowerShell(value: string): string {
    return `'${value.replace(POWERSHELL_SINGLE_QUOTE_PATTERN, "''")}'`;
}

function quotePosix(value: string): string {
    return `'${value.replace(POSIX_SINGLE_QUOTE_PATTERN, "'\\''")}'`;
}

function quoteForShell(shell: OllamaCommandShell, value: string): string {
    return shell === 'powershell' ? quotePowerShell(value) : quotePosix(value);
}

export function resolveOllamaCommandShell(platform: string): OllamaCommandShell {
    return WINDOWS_PLATFORM_PATTERN.test(platform) ? 'powershell' : 'posix';
}

function exposeNetworkCommands(shell: OllamaCommandShell, platform: string): string[] {
    if (shell === 'powershell') {
        return [
            `[Environment]::SetEnvironmentVariable('OLLAMA_HOST', '${OLLAMA_DEFAULT_NETWORK_HOST}', 'User')`,
            'Get-Process ollama | Stop-Process',
            'ollama serve',
        ];
    }
    if (MACOS_PLATFORM_PATTERN.test(platform)) {
        return [
            `launchctl setenv OLLAMA_HOST "${OLLAMA_DEFAULT_NETWORK_HOST}"`,
            'pkill ollama',
            'ollama serve',
        ];
    }
    return [
        'sudo systemctl edit ollama.service',
        `[Service]\nEnvironment="OLLAMA_HOST=${OLLAMA_DEFAULT_NETWORK_HOST}"`,
        'sudo systemctl daemon-reload',
        'sudo systemctl restart ollama',
    ];
}

function runLocalServerCommands(shell: OllamaCommandShell, platform: string): string[] {
    if (shell === 'powershell') {
        return ['.\\evai-server.exe', `Start-Process ${quotePowerShell(LOCAL_SERVER_DEFAULT_URL)}`];
    }
    const openCommand = MACOS_PLATFORM_PATTERN.test(platform) ? 'open' : 'xdg-open';
    return ['./evai-server', `${openCommand} ${quotePosix(LOCAL_SERVER_DEFAULT_URL)}`];
}

function createFromGgufCommands(shell: OllamaCommandShell, modelName: string, ggufPath: string): string[] {
    const quotedModel = quoteForShell(shell, modelName);
    if (shell === 'powershell') {
        return [
            `Set-Content "$env:TEMP\\Modelfile.evai" ${quotePowerShell(`FROM ${ggufPath}`)}`,
            `ollama create ${quotedModel} -f "$env:TEMP\\Modelfile.evai"`,
            'Remove-Item "$env:TEMP\\Modelfile.evai" -Force',
        ];
    }
    return [
        `printf '%s\\n' ${quotePosix(`FROM ${ggufPath}`)} > /tmp/Modelfile.evai`,
        `ollama create ${quotedModel} -f /tmp/Modelfile.evai`,
        'rm -f /tmp/Modelfile.evai',
    ];
}

export function buildOllamaCommandGuide(platform: string, input: OllamaCommandGuideInput): OllamaCommandStep[] {
    const shell = resolveOllamaCommandShell(platform);
    const modelName = input.model_name.trim();
    const ggufPath = input.gguf_path.trim();
    const quotedModel = quoteForShell(shell, modelName);
    return [
        { key: 'verify_install', commands: ['ollama --version'] },
        ...(modelName.length > 0 ? [{ key: 'pull_model' as const, commands: [`ollama pull ${quotedModel}`] }] : []),
        ...(modelName.length > 0 && ggufPath.length > 0 ? [{ key: 'create_from_gguf' as const, commands: createFromGgufCommands(shell, modelName, ggufPath) }] : []),
        { key: 'run_model', commands: modelName.length > 0 ? [`ollama run ${quotedModel}`, 'ollama ls', 'ollama ps'] : ['ollama ls', 'ollama ps'] },
        ...(modelName.length > 0 ? [{ key: 'remove_model' as const, commands: [`ollama rm ${quotedModel}`] }] : []),
        { key: 'run_local_server', commands: runLocalServerCommands(shell, platform) },
        { key: 'expose_network', commands: exposeNetworkCommands(shell, platform) },
    ];
}
