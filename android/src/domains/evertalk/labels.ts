import type { DomainErrorCode } from '../../../../src/shared/errors';
import type { AppLanguage } from '../../../../src/shared/types';
import { getEverTalkLabels, type EverTalkLabels, type LocalModelSectionLabels } from '../../../../src/domains/evertalk/i18n';
import type { AssetVoiceLanguage } from '../assets/types';
import type { LocalModelEngineKind } from '../llm/types';

export interface AndroidLabelExtensions {
    assetTitle: string;
    assetDescription: string;
    assetChecking: string;
    assetDownloading: string;
    assetPresent: string;
    assetRelocated: string;
    assetDownloaded: string;
    assetFailed: string;
    assetVoicePrompt: string;
    assetVoiceDescription: string;
    assetVoiceNames: Record<AssetVoiceLanguage, string>;
    assetProgressCount: (completed: number, total: number) => string;
    assetMegabytes: (megabytes: string) => string;
    assetProgressBytes: (megabytes: string, totalMegabytes: string) => string;
    assetListError: (detail: string) => string;
    assetRetry: string;
    assetContinue: string;
    assetCancel: string;
    assetSettingsTitle: string;
    assetSettingsDescription: string;
    assetVoiceCurrent: (voice: string) => string;
    assetRecheck: string;
    localModelUrlTitle: string;
    localModelUrlPlaceholder: string;
    localModelUrlHint: string;
    localModelUrlDownload: string;
    localModelBundled: string;
    localModelTransferring: (megabytes: string) => string;
    deviceTitle: string;
    deviceManufacturer: string;
    deviceModel: string;
    deviceAndroid: (release: string, sdk: number) => string;
    deviceSoc: string;
    deviceCpuCores: (cores: number) => string;
    deviceMemory: (availableMegabytes: number, totalMegabytes: number) => string;
    deviceStorage: (availableMegabytes: number, totalMegabytes: number) => string;
    deviceAppVersion: string;
    deviceAbis: string;
    deviceLowMemory: string;
    deviceLocales: string;
    confirmTitle: string;
    confirmCancel: string;
    confirmAccept: string;
    menu: string;
    back: string;
}

export type AndroidLabels = EverTalkLabels & AndroidLabelExtensions & {
    localModelSections: Record<LocalModelEngineKind, LocalModelSectionLabels>;
};

type AndroidLabelOverrides = Pick<
    EverTalkLabels,
    | 'platformGuideItems'
    | 'platformGuideCheckbox'
    | 'modelListDescription'
    | 'resetDescription'
    | 'resetStorageScope'
    | 'backupDescription'
    | 'backupStorageScope'
    | 'storageBackendName'
    | 'ollamaModelSectionDescription'
    | 'ollamaServerUnavailable'
    | 'ollamaBaseUrlHint'
    | 'ollamaGuideDescription'
    | 'browserManagedLocation'
    | 'browserManagedLocationDetail'
    | 'storageUsage'
    | 'storageQuota'
    | 'backupExport'
    | 'backupImport'
    | 'backupFolderDescription'
    | 'backupFolderLink'
>;

function overrideLabels(root: EverTalkLabels, language: AppLanguage): AndroidLabelOverrides {
    if (language === 'en') {
        return {
            platformGuideItems: {
                ...root.platformGuideItems,
                android_app: (modelSettingsPath) => [
                    'The EverTalk AI Chat Android app runs AI inside this device with the llama.cpp engine built into the app. Conversations and model files are never sent to a server.',
                    `Before your first chat, choose a model in ${modelSettingsPath}. A small built-in GGUF model is included in the app, and you can add more by downloading GGUF models over HTTP(S) or importing a .gguf file. You can also connect to Ollama running on a PC on the same network.`,
                    'On-device models run on the CPU. You need free storage at least as large as the model file and enough memory; larger models answer more slowly.',
                ],
            },
            platformGuideCheckbox: {
                ...root.platformGuideCheckbox,
                android_app: 'I have read the notice above and understand that this app runs GGUF models on this device or an Ollama server I connect.',
            },
            modelListDescription: {
                ...root.modelListDescription,
                android_app: 'Choose the model used for chat. GGUF models run on this device with the llama.cpp engine, and models installed in Ollama on another computer appear in local Ollama mode once its network address is saved. The chosen model stays fixed for chats.',
            },
            resetDescription: {
                ...root.resetDescription,
                sqlite: 'Deletes every row of the app-internal SQLite database, the app preferences, and the backup folder link, including chats, soul/style/knowledge data, memories, modules, and settings, then restarts the app. Downloaded assets and model files are kept.',
            },
            resetStorageScope: {
                ...root.resetStorageScope,
                sqlite: 'Resets the app-internal SQLite database, the app preferences, and the backup folder link.',
            },
            backupDescription: {
                ...root.backupDescription,
                sqlite: 'Only when you press Export does the app write the serializable data of its internal SQLite database (chats, memories, settings, modules, and more) into a JSON file; importing validates it, replaces the data in a single transaction, and restarts the app. There is no automatic backup.',
            },
            backupStorageScope: {
                ...root.backupStorageScope,
                sqlite: 'The JSON file replaces the serializable data of the app-internal SQLite database. App preferences and folder permissions are excluded.',
            },
            storageBackendName: { ...root.storageBackendName, sqlite: 'App-internal SQLite database' },
            ollamaModelSectionDescription: 'Manage the connection state and network address of Ollama running on another computer. Every model installed in that Ollama appears in local Ollama mode of the chat model selector above, and conversation, memory, and persona rules apply exactly as in on-device AI mode.',
            ollamaServerUnavailable: 'Ollama is not connected · check that Ollama is running, that it listens on the network, and that the address below is correct',
            ollamaBaseUrlHint: 'The network address of the computer running Ollama, such as http://192.168.0.10:11434. Enter only the http protocol, host, and port without a path. The saved value is written to the app-internal SQLite settings.',
            ollamaGuideDescription: 'This app connects directly to Ollama on a computer in the same network. Prepare Ollama with the commands below, expose it to the network, save its address, then press "Check connection". Connected models are chosen in local Ollama mode under Chat Models, and the chosen model stays fixed for chats.',
            browserManagedLocation: 'App-internal storage',
            browserManagedLocationDetail: 'The database lives in the private storage area of this app, which other apps cannot read. Its path is shown below.',
            storageUsage: 'Database file size',
            storageQuota: 'Storage quota',
            backupExport: 'Export to file',
            backupImport: 'Import from file',
            backupFolderDescription: 'There is no automatic backup. A JSON backup file is written to the linked folder only when you press Back up now, and you can restore any point from the list exactly as it was.',
            backupFolderLink: 'Link backup folder',
        };
    }
    if (language === 'zh_cn') {
        return {
            platformGuideItems: {
                ...root.platformGuideItems,
                android_app: (modelSettingsPath) => [
                    'EverTalk AI 聊天安卓应用通过内置于应用的 llama.cpp 引擎在本设备内运行 AI。对话和模型文件不会发送到服务器。',
                    `首次对话前，请在“${modelSettingsPath}”中选择模型。应用内置一个小型 GGUF 模型，也可以通过 HTTP(S) 下载 GGUF 模型或导入 .gguf 文件来添加更多模型，还可以连接同一网络中电脑上运行的 Ollama。`,
                    '设备端模型在 CPU 上运行。需要不小于模型文件大小的可用存储空间和足够的内存；模型越大，回复越慢。',
                ],
            },
            platformGuideCheckbox: {
                ...root.platformGuideCheckbox,
                android_app: '我已阅读以上说明，并了解本应用使用本设备上的 GGUF 模型或我连接的 Ollama 服务器运行。',
            },
            modelListDescription: {
                ...root.modelListDescription,
                android_app: '选择用于对话的模型。GGUF 模型通过 llama.cpp 引擎在本设备上运行；保存另一台电脑上 Ollama 的网络地址后，其中安装的模型会出现在本地 Ollama 模式中。所选模型会固定用于对话。',
            },
            resetDescription: {
                ...root.resetDescription,
                sqlite: '删除应用内部 SQLite 数据库的全部数据、应用偏好设置和备份文件夹连接，包括聊天、精灵/风格/知识数据、记忆、模块与设置，然后重新启动应用。已下载的资源和模型文件会保留。',
            },
            resetStorageScope: {
                ...root.resetStorageScope,
                sqlite: '重置应用内部 SQLite 数据库、应用偏好设置和备份文件夹连接。',
            },
            backupDescription: {
                ...root.backupDescription,
                sqlite: '只有在你按下导出时，应用才会把内部 SQLite 数据库中可序列化的数据（聊天、记忆、设置、模块等）写成 JSON 文件；导入时先验证，再以单个事务替换数据并重新启动应用。没有自动备份。',
            },
            backupStorageScope: {
                ...root.backupStorageScope,
                sqlite: 'JSON 文件会替换应用内部 SQLite 数据库中可序列化的数据。应用偏好设置与文件夹权限不包含在内。',
            },
            storageBackendName: { ...root.storageBackendName, sqlite: '应用内部 SQLite 数据库' },
            ollamaModelSectionDescription: '管理另一台电脑上运行的 Ollama 的连接状态与网络地址。该 Ollama 中安装的所有模型会出现在上方对话模型选择的本地 Ollama 模式中，对话、记忆与角色设定规则与设备端 AI 模式完全相同。',
            ollamaServerUnavailable: '未连接 Ollama · 请确认 Ollama 正在运行并已对网络开放，以及下方地址是否正确',
            ollamaBaseUrlHint: '运行 Ollama 的电脑的网络地址，例如 http://192.168.0.10:11434。只输入 http 协议、主机和端口，不含路径。保存的值写入应用内部 SQLite 设置。',
            ollamaGuideDescription: '本应用直接连接同一网络中电脑上的 Ollama。请按下面的命令准备 Ollama 并对网络开放，保存其地址后点击“检查连接”。已连接的模型请在对话模型中以本地 Ollama 模式选择，所选模型会固定用于对话。',
            browserManagedLocation: '应用内部存储',
            browserManagedLocationDetail: '数据库位于本应用的私有存储区域，其他应用无法读取。其路径显示在下方。',
            storageUsage: '数据库文件大小',
            storageQuota: '存储配额',
            backupExport: '导出为文件',
            backupImport: '从文件导入',
            backupFolderDescription: '没有自动备份。只有按下“立即备份”时才会在已连接的文件夹中写入 JSON 备份文件，并可从列表选择任意时间点原样恢复。',
            backupFolderLink: '连接备份文件夹',
        };
    }
    return {
        platformGuideItems: {
            ...root.platformGuideItems,
            android_app: (modelSettingsPath) => [
                '에버톡 AI 채팅 안드로이드 앱은 앱에 내장된 llama.cpp 엔진으로 이 기기 안에서 AI를 실행합니다. 대화와 모델 파일은 서버로 전송되지 않습니다.',
                `처음 대화하기 전에 ${modelSettingsPath}에서 모델을 선택해야 합니다. 앱에는 작은 GGUF 모델이 내장되어 있고, HTTP(S)로 GGUF 모델을 내려받거나 .gguf 파일을 가져와 더 추가할 수 있으며, 같은 네트워크의 PC에서 실행 중인 Ollama에도 연결할 수 있습니다.`,
                '온디바이스 모델은 CPU에서 실행됩니다. 모델 파일 크기만큼의 여유 저장 공간과 충분한 메모리가 필요하며, 큰 모델일수록 응답이 느려집니다.',
            ],
        },
        platformGuideCheckbox: {
            ...root.platformGuideCheckbox,
            android_app: '위 안내를 확인했으며, 이 앱은 이 기기의 GGUF 모델 또는 내가 연결한 Ollama 서버로 동작함을 이해했습니다.',
        },
        modelListDescription: {
            ...root.modelListDescription,
            android_app: '대화에 사용할 모델을 선택합니다. GGUF 모델은 llama.cpp 엔진으로 이 기기에서 실행되고, 다른 컴퓨터의 Ollama 네트워크 주소를 저장하면 그 Ollama에 설치된 모델이 로컬 Ollama 모드에 함께 표시됩니다. 선택한 모델이 대화에 고정됩니다.',
        },
        resetDescription: {
            ...root.resetDescription,
            sqlite: '앱 내부 SQLite 데이터베이스의 모든 행, 앱 환경설정, 백업 폴더 연결을 삭제해 대화, 정령/스타일/지식팩, 기억, 모듈, 설정을 초기 상태로 되돌린 뒤 앱을 다시 시작합니다. 내려받은 에셋과 모델 파일은 유지됩니다.',
        },
        resetStorageScope: {
            ...root.resetStorageScope,
            sqlite: '앱 내부 SQLite 데이터베이스, 앱 환경설정, 백업 폴더 연결을 초기화합니다.',
        },
        backupDescription: {
            ...root.backupDescription,
            sqlite: '내보내기를 누를 때만 앱 내부 SQLite 데이터베이스의 직렬화 가능한 데이터(대화, 기억, 설정, 모듈 등)를 JSON 파일로 만들고, 불러올 때는 검증 후 한 번의 트랜잭션으로 교체한 뒤 앱을 다시 시작합니다. 자동 백업은 없습니다.',
        },
        backupStorageScope: {
            ...root.backupStorageScope,
            sqlite: 'JSON 파일은 앱 내부 SQLite 데이터베이스의 직렬화 가능한 데이터를 교체 복원합니다. 앱 환경설정과 폴더 권한은 제외됩니다.',
        },
        storageBackendName: { ...root.storageBackendName, sqlite: '앱 내부 SQLite 데이터베이스' },
        ollamaModelSectionDescription: '다른 컴퓨터에서 실행 중인 Ollama의 연결 상태와 네트워크 주소를 관리합니다. 그 Ollama에 설치된 모든 모델은 위 대화 모델 선택의 로컬 Ollama 모드에 나타나며, 대화·기억·페르소나 규칙은 온디바이스 AI 모드와 동일하게 적용됩니다.',
        ollamaServerUnavailable: 'Ollama에 연결되지 않음 · Ollama 실행 여부, 네트워크 공개 설정, 아래 주소를 확인하세요',
        ollamaBaseUrlHint: 'Ollama를 실행 중인 컴퓨터의 네트워크 주소입니다. 예: http://192.168.0.10:11434. 경로 없이 http 프로토콜·호스트·포트만 입력합니다. 저장한 값은 앱 내부 SQLite 설정에 기록됩니다.',
        ollamaGuideDescription: '이 앱은 같은 네트워크에 있는 컴퓨터의 Ollama에 직접 연결합니다. 아래 명령으로 Ollama를 준비하고 네트워크에 공개한 뒤 주소를 저장하고 "연결 확인"을 누르세요. 연결된 모델은 대화 모델의 로컬 Ollama 모드에서 선택하며, 선택한 모델이 대화에 고정됩니다.',
        browserManagedLocation: '앱 내부 저장소',
        browserManagedLocationDetail: '데이터베이스는 다른 앱이 읽을 수 없는 이 앱 전용 저장 영역에 있습니다. 경로는 아래에 표시됩니다.',
        storageUsage: '데이터베이스 파일 크기',
        storageQuota: '저장 공간 할당량',
        backupExport: '파일로 내보내기',
        backupImport: '파일에서 불러오기',
        backupFolderDescription: '자동 백업은 없습니다. 지금 백업을 누를 때만 연결한 폴더에 JSON 백업 파일이 만들어지고, 목록에서 원하는 시점을 골라 그대로 복원할 수 있습니다.',
        backupFolderLink: '백업 폴더 연결',
    };
}

function localModelSectionLabels(language: AppLanguage): Record<LocalModelEngineKind, LocalModelSectionLabels> {
    if (language === 'en') {
        return {
            llama_cpp: {
                title: 'GGUF Models (llama.cpp)',
                description: 'Runs GGUF models inside this device with the llama.cpp engine built into the app. Model files are kept only in the app\'s internal storage, and conversations, memories, persona rules, and the no-emoji rule apply the same way.',
                installFile: 'Import GGUF file',
                customModel: 'Added GGUF model',
                guideTitle: 'GGUF Model Installation Guide',
                guideSteps: (downloadLabel, installLabel, useLabel, removeLabel) => [
                    `Press "${downloadLabel}" on a recommended model and the app downloads its .gguf file from Hugging Face over HTTPS straight into internal storage. An interrupted download resumes from where it stopped.`,
                    'To use another model, paste a direct HTTP or HTTPS link to a .gguf file into the address field and download it. Hugging Face file page links are converted to download links automatically.',
                    `Press "${installLabel}" and choose a .gguf file already on this device; it is copied into the app's internal storage. After the copy finishes you can delete the original file.`,
                    `Choose an installed model in on-device AI mode of "${useLabel}" above to load it. When loading finishes, you can chat with the selected spirit right away.`,
                    `Remove models you no longer need with "${removeLabel}". The model built into the app cannot be removed.`,
                ],
            },
        };
    }
    if (language === 'zh_cn') {
        return {
            llama_cpp: {
                title: 'GGUF 模型（llama.cpp）',
                description: '通过内置于应用的 llama.cpp 引擎在本设备内运行 GGUF 模型。模型文件只保存在应用内部存储中，对话、记忆、角色设定和禁用表情符号的规则同样适用。',
                installFile: '导入 GGUF 文件',
                customModel: '添加的 GGUF 模型',
                guideTitle: 'GGUF 模型安装指南',
                guideSteps: (downloadLabel, installLabel, useLabel, removeLabel) => [
                    `点击推荐模型的“${downloadLabel}”，应用会通过 HTTPS 从 Hugging Face 将 .gguf 文件直接下载到内部存储。下载中断后会从中断处继续。`,
                    '要使用其他模型，请将 .gguf 文件的 HTTP 或 HTTPS 直链粘贴到地址栏后下载。Hugging Face 文件页面链接会自动转换为下载链接。',
                    `点击“${installLabel}”并选择本设备上已有的 .gguf 文件，文件会被复制到应用内部存储中。复制完成后可以删除原始文件。`,
                    `在上方“${useLabel}”的设备端 AI 模式中选择已安装的模型即可加载。加载完成后即可与所选精灵对话。`,
                    `不再需要的模型可以用“${removeLabel}”删除。应用内置的模型无法删除。`,
                ],
            },
        };
    }
    return {
        llama_cpp: {
            title: 'GGUF 모델 (llama.cpp)',
            description: '앱에 내장된 llama.cpp 엔진으로 GGUF 모델을 이 기기 안에서 실행합니다. 모델 파일은 앱 내부 저장소에만 보관되며, 대화·기억·페르소나·이모지 금지 규칙은 똑같이 적용됩니다.',
            installFile: 'GGUF 파일 가져오기',
            customModel: '추가한 GGUF 모델',
            guideTitle: 'GGUF 모델 설치 가이드',
            guideSteps: (downloadLabel, installLabel, useLabel, removeLabel) => [
                `추천 모델의 "${downloadLabel}"를 누르면 앱이 Hugging Face에서 HTTPS로 .gguf 파일을 앱 내부 저장소에 바로 내려받습니다. 중간에 끊기면 끊긴 지점부터 이어받습니다.`,
                '다른 모델을 쓰려면 .gguf 파일의 HTTP 또는 HTTPS 직접 링크를 주소 칸에 붙여 넣고 내려받습니다. Hugging Face 파일 페이지 링크는 다운로드 링크로 자동 변환됩니다.',
                `"${installLabel}"을 눌러 이 기기에 있는 .gguf 파일을 고르면 앱 내부 저장소로 복사됩니다. 복사가 끝나면 원본 파일은 지워도 됩니다.`,
                `위 "${useLabel}"의 온디바이스 AI 모드에서 설치된 모델을 고르면 모델을 불러옵니다. 불러오기가 끝나면 선택한 정령과 바로 대화할 수 있습니다.`,
                `다 쓴 모델은 "${removeLabel}"로 지웁니다. 앱에 내장된 모델은 지울 수 없습니다.`,
            ],
        },
    };
}

function extensionLabels(language: AppLanguage): AndroidLabelExtensions {
    if (language === 'en') {
        return {
            assetTitle: 'Assets',
            assetDescription: 'Spirit images, backgrounds, story data, voices, and music are downloaded into the app and kept in sync with the asset list, exactly as the PC server does.',
            assetChecking: 'checking index',
            assetDownloading: 'downloading',
            assetPresent: 'present',
            assetRelocated: 'relocated',
            assetDownloaded: 'downloaded',
            assetFailed: 'failed',
            assetVoicePrompt: 'Voice language',
            assetVoiceDescription: 'Choose which story voice files to download. You can change this later in Settings.',
            assetVoiceNames: { ko: 'Korean', ja: 'Japanese', both: 'Both', none: 'Skip' },
            assetProgressCount: (completed, total) => `${completed}/${total}`,
            assetMegabytes: (megabytes) => `${megabytes} MB`,
            assetProgressBytes: (megabytes, totalMegabytes) => `${megabytes}/${totalMegabytes} MB`,
            assetListError: (detail) => `The asset list could not be refreshed · ${detail}`,
            assetRetry: 'Retry',
            assetContinue: 'Continue',
            assetCancel: 'Cancel',
            assetSettingsTitle: 'Assets and voice',
            assetSettingsDescription: 'Check downloaded assets against the latest list and fetch what is missing. Changing the voice language downloads the matching voice files.',
            assetVoiceCurrent: (voice) => `Voice language: ${voice}`,
            assetRecheck: 'Check assets now',
            localModelUrlTitle: 'Download from an HTTP link',
            localModelUrlPlaceholder: 'https://huggingface.co/…/model.gguf',
            localModelUrlHint: 'Enter a direct HTTP or HTTPS link that ends with a .gguf file name.',
            localModelUrlDownload: 'Download',
            localModelBundled: 'Built into the app',
            localModelTransferring: (megabytes) => `Receiving ${megabytes} MB`,
            deviceTitle: 'This device',
            deviceManufacturer: 'Manufacturer',
            deviceModel: 'Model',
            deviceAndroid: (release, sdk) => `Android ${release} (API ${sdk})`,
            deviceSoc: 'Chipset',
            deviceCpuCores: (cores) => `${cores} CPU cores`,
            deviceMemory: (available, total) => `Memory ${available.toLocaleString('en-US')} / ${total.toLocaleString('en-US')} MB available`,
            deviceStorage: (available, total) => `Storage ${available.toLocaleString('en-US')} / ${total.toLocaleString('en-US')} MB available`,
            deviceAppVersion: 'App version',
            deviceAbis: 'Supported ABIs',
            deviceLowMemory: 'The system reports low memory',
            deviceLocales: 'Device languages',
            confirmTitle: 'Confirm',
            confirmCancel: 'Cancel',
            confirmAccept: 'OK',
            menu: 'Menu',
            back: 'Back',
        };
    }
    if (language === 'zh_cn') {
        return {
            assetTitle: '资源',
            assetDescription: '精灵图片、背景、剧情数据、语音与音乐会下载到应用中，并像电脑服务器一样与资源清单保持一致。',
            assetChecking: '正在检查清单',
            assetDownloading: '正在下载',
            assetPresent: '已有',
            assetRelocated: '已归位',
            assetDownloaded: '新下载',
            assetFailed: '失败',
            assetVoicePrompt: '语音语言',
            assetVoiceDescription: '选择要下载的剧情语音文件。之后可以在设置中更改。',
            assetVoiceNames: { ko: '韩语', ja: '日语', both: '全部', none: '不下载' },
            assetProgressCount: (completed, total) => `${completed}/${total}`,
            assetMegabytes: (megabytes) => `${megabytes} MB`,
            assetProgressBytes: (megabytes, totalMegabytes) => `${megabytes}/${totalMegabytes} MB`,
            assetListError: (detail) => `无法刷新资源清单 · ${detail}`,
            assetRetry: '重试',
            assetContinue: '继续',
            assetCancel: '取消',
            assetSettingsTitle: '资源与语音',
            assetSettingsDescription: '按最新清单检查已下载的资源并补齐缺失的文件。更改语音语言后会下载对应的语音文件。',
            assetVoiceCurrent: (voice) => `语音语言：${voice}`,
            assetRecheck: '立即检查资源',
            localModelUrlTitle: '通过 HTTP 链接下载',
            localModelUrlPlaceholder: 'https://huggingface.co/…/model.gguf',
            localModelUrlHint: '请输入以 .gguf 文件名结尾的 HTTP 或 HTTPS 直链。',
            localModelUrlDownload: '下载',
            localModelBundled: '应用内置',
            localModelTransferring: (megabytes) => `已接收 ${megabytes} MB`,
            deviceTitle: '本设备',
            deviceManufacturer: '制造商',
            deviceModel: '型号',
            deviceAndroid: (release, sdk) => `Android ${release}（API ${sdk}）`,
            deviceSoc: '芯片组',
            deviceCpuCores: (cores) => `${cores} 个 CPU 核心`,
            deviceMemory: (available, total) => `内存 可用 ${available.toLocaleString('zh-CN')} / ${total.toLocaleString('zh-CN')} MB`,
            deviceStorage: (available, total) => `存储 可用 ${available.toLocaleString('zh-CN')} / ${total.toLocaleString('zh-CN')} MB`,
            deviceAppVersion: '应用版本',
            deviceAbis: '支持的 ABI',
            deviceLowMemory: '系统报告内存不足',
            deviceLocales: '设备语言',
            confirmTitle: '确认',
            confirmCancel: '取消',
            confirmAccept: '确定',
            menu: '菜单',
            back: '返回',
        };
    }
    return {
        assetTitle: '에셋',
        assetDescription: '정령 이미지, 배경, 스토리 데이터, 음성, 음악을 앱 안으로 내려받고, PC 서버와 똑같이 에셋 목록과 맞춰 유지합니다.',
        assetChecking: '목록 확인 중',
        assetDownloading: '내려받는 중',
        assetPresent: '보유',
        assetRelocated: '재배치',
        assetDownloaded: '새로 받음',
        assetFailed: '실패',
        assetVoicePrompt: '음성 언어 선택',
        assetVoiceDescription: '내려받을 스토리 음성 파일을 고르세요. 나중에 설정에서 바꿀 수 있습니다.',
        assetVoiceNames: { ko: '한국어', ja: '日本語', both: '둘 다', none: '받지 않음' },
        assetProgressCount: (completed, total) => `${completed}/${total}`,
        assetMegabytes: (megabytes) => `${megabytes} MB`,
        assetProgressBytes: (megabytes, totalMegabytes) => `${megabytes}/${totalMegabytes} MB`,
        assetListError: (detail) => `에셋 목록을 갱신하지 못했습니다 · ${detail}`,
        assetRetry: '다시 시도',
        assetContinue: '계속',
        assetCancel: '취소',
        assetSettingsTitle: '에셋과 음성',
        assetSettingsDescription: '내려받은 에셋을 최신 목록과 대조해 빠진 파일을 받습니다. 음성 언어를 바꾸면 해당 음성 파일을 내려받습니다.',
        assetVoiceCurrent: (voice) => `음성 언어: ${voice}`,
        assetRecheck: '지금 에셋 확인',
        localModelUrlTitle: 'HTTP 링크로 내려받기',
        localModelUrlPlaceholder: 'https://huggingface.co/…/model.gguf',
        localModelUrlHint: '.gguf 파일 이름으로 끝나는 HTTP 또는 HTTPS 직접 링크를 입력하세요.',
        localModelUrlDownload: '내려받기',
        localModelBundled: '앱 내장',
        localModelTransferring: (megabytes) => `${megabytes} MB 받는 중`,
        deviceTitle: '이 기기',
        deviceManufacturer: '제조사',
        deviceModel: '모델',
        deviceAndroid: (release, sdk) => `Android ${release} (API ${sdk})`,
        deviceSoc: '칩셋',
        deviceCpuCores: (cores) => `CPU 코어 ${cores}개`,
        deviceMemory: (available, total) => `메모리 ${available.toLocaleString('ko-KR')} / ${total.toLocaleString('ko-KR')} MB 사용 가능`,
        deviceStorage: (available, total) => `저장 공간 ${available.toLocaleString('ko-KR')} / ${total.toLocaleString('ko-KR')} MB 사용 가능`,
        deviceAppVersion: '앱 버전',
        deviceAbis: '지원 ABI',
        deviceLowMemory: '시스템이 메모리 부족을 보고했습니다',
        deviceLocales: '기기 언어',
        confirmTitle: '확인',
        confirmCancel: '취소',
        confirmAccept: '확인',
        menu: '메뉴',
        back: '뒤로',
    };
}

function androidDomainErrorMessage(root: EverTalkLabels, language: AppLanguage): (code: DomainErrorCode, detail: string) => string {
    return (code, detail) => {
        if (code !== 'invalid_model_file') {
            return root.domainErrorMessage(code, detail);
        }
        if (language === 'en') {
            return `This model file cannot be used. Choose a GGUF file whose name ends with .gguf (${detail})`;
        }
        if (language === 'zh_cn') {
            return `无法使用此模型文件。请选择文件名以 .gguf 结尾的 GGUF 文件（${detail}）`;
        }
        return `사용할 수 없는 모델 파일입니다. 이름이 .gguf로 끝나는 GGUF 파일을 고르세요 (${detail})`;
    };
}

const androidLabelCache = new Map<AppLanguage, AndroidLabels>();

export function getAndroidLabels(language: AppLanguage): AndroidLabels {
    const cached = androidLabelCache.get(language);
    if (cached !== undefined) {
        return cached;
    }
    const root = getEverTalkLabels(language);
    const labels: AndroidLabels = {
        ...root,
        ...overrideLabels(root, language),
        ...extensionLabels(language),
        localModelSections: { ...root.localModelSections, ...localModelSectionLabels(language) },
        domainErrorMessage: androidDomainErrorMessage(root, language),
    };
    androidLabelCache.set(language, labels);
    return labels;
}
