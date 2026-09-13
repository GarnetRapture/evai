import type { OllamaCommandShell, OllamaCommandStep, OllamaOriginAccess } from './types';

const WINDOWS_PLATFORM_PATTERN = /^win/iu;
const MACOS_PLATFORM_PATTERN = /^mac/iu;
const EXAMPLE_MODEL_NAME = 'evai-model';
const EXAMPLE_REMOVED_MODEL_NAME = 'old-model';
const EXAMPLE_HUB_MODEL_NAME = 'llama3.2';
const EXAMPLE_WINDOWS_GGUF_PATH = 'D:\\model\\my-model.gguf';
const EXAMPLE_POSIX_GGUF_PATH = '/path/to/my-model.gguf';

export function resolveOllamaCommandShell(platform: string): OllamaCommandShell {
    return WINDOWS_PLATFORM_PATTERN.test(platform) ? 'powershell' : 'posix';
}

function allowOriginCommands(shell: OllamaCommandShell, platform: string, origin: string): string[] {
    if (shell === 'powershell') {
        return [`[Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', '${origin}', 'User')`];
    }
    if (MACOS_PLATFORM_PATTERN.test(platform)) {
        return [`launchctl setenv OLLAMA_ORIGINS "${origin}"`];
    }
    return [
        'sudo systemctl edit ollama.service',
        `[Service]\nEnvironment="OLLAMA_ORIGINS=${origin}"`,
        'sudo systemctl daemon-reload',
        'sudo systemctl restart ollama',
    ];
}

export function buildOllamaCommandGuide(platform: string, originAccess: OllamaOriginAccess): OllamaCommandStep[] {
    const shell = resolveOllamaCommandShell(platform);
    const steps: OllamaCommandStep[] = [
        { key: 'verify_install', commands: ['ollama --version'] },
        { key: 'pull_model', commands: [`ollama pull ${EXAMPLE_HUB_MODEL_NAME}`] },
        {
            key: 'create_from_gguf',
            commands: shell === 'powershell'
                ? [
                    `Set-Content "$env:TEMP\\Modelfile.evai" 'FROM ${EXAMPLE_WINDOWS_GGUF_PATH}'`,
                    `ollama create ${EXAMPLE_MODEL_NAME} -f "$env:TEMP\\Modelfile.evai"`,
                    'Remove-Item "$env:TEMP\\Modelfile.evai" -Force',
                ]
                : [
                    `printf 'FROM ${EXAMPLE_POSIX_GGUF_PATH}\\n' > /tmp/Modelfile.evai`,
                    `ollama create ${EXAMPLE_MODEL_NAME} -f /tmp/Modelfile.evai`,
                    'rm -f /tmp/Modelfile.evai',
                ],
        },
        { key: 'remove_model', commands: [`ollama rm ${EXAMPLE_REMOVED_MODEL_NAME}`] },
        { key: 'run_model', commands: [`ollama run ${EXAMPLE_MODEL_NAME}`, 'ollama ls', 'ollama ps'] },
    ];
    return originAccess.allowed_by_default
        ? steps
        : [...steps, { key: 'allow_origin', commands: allowOriginCommands(shell, platform, originAccess.origin) }];
}
