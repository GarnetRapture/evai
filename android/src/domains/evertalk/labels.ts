import type { DomainErrorCode } from '../../../../src/shared/errors';
import type { AppLanguage } from '../../../../src/shared/types';
import { getEverTalkLabels, type EverTalkLabels, type LocalModelSectionLabels } from '../../../../src/domains/evertalk/i18n';
import { formatModelSettingsPath } from '../../../../src/domains/evertalk/logic';
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
    storyMoviePlay: string;
    storyMoviePause: string;
    storyMoviePosition: string;
    storyMovieMute: string;
    storyMovieUnmute: string;
    ollamaHostPlatformTitle: string;
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
    | 'chatModelModeEmpty'
    | 'guidePageDescription'
    | 'guideBeginnerIntro'
    | 'guideConcepts'
    | 'guideChecklistIntro'
    | 'guideStepTitles'
    | 'guideStepDescriptions'
    | 'memoryGraphSelectHint'
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
            chatModelModeEmpty: {
                ...root.chatModelModeEmpty,
                on_device: `No GGUF model on this device can be selected right now. Download or import a GGUF model in ${formatModelSettingsPath(root)}, then choose it.`,
            },
            guidePageDescription: 'A step-by-step walkthrough, matched to the current state of this device, from what an AI model is to your first conversation with a spirit.',
            guideBeginnerIntro: 'EverTalk writes each spirit\'s replies with an AI that runs inside this device, not an online AI service. Your conversations never leave the device, and a small GGUF model ships with the app so you can start right away. Read the terms below once, then follow "Follow along with your current setup" from the top.',
            guideConcepts: [
                root.guideConcepts[0],
                {
                    term: 'Local LLM',
                    description: 'An AI model that runs on this device\'s processor (CPU) and memory instead of a company server. There is no usage fee and chats stay on the device, but reply speed and usable model size depend on the device.',
                },
                {
                    term: 'Built-in on-device AI (llama.cpp)',
                    description: `The llama.cpp engine inside this app runs GGUF model files directly on this device. A small GGUF model is included, so you can start without installing anything, and you can download or import other GGUF models in ${formatModelSettingsPath(root)}.`,
                },
                {
                    term: 'Ollama',
                    description: 'A free program that downloads and runs local LLMs on a computer. Install it on a computer in the same network, expose it to the network and save its address, and this app connects to it so you can use larger, more expressive models than a phone can run.',
                },
                root.guideConcepts[4],
                {
                    term: 'Hugging Face · GGUF',
                    description: `Hugging Face is the site where AI models are published, and GGUF is the file format for local LLMs. Paste the address of a GGUF file on Hugging Face into the URL download of ${formatModelSettingsPath(root)} to receive it on this device, or pull it into Ollama on a computer with ollama pull hf.co/user/repository.`,
                },
                {
                    term: 'EverTalk Android app',
                    description: 'Chats, memories and settings are stored in the SQLite database in this app\'s private storage, and assets such as spirit images and voices are downloaded on first launch and kept on the device. No other computer or server has to stay on.',
                },
            ],
            guideChecklistIntro: {
                ...root.guideChecklistIntro,
                local_server: 'This app runs GGUF models on this device with its built-in llama.cpp engine, so you can start right away; connecting Ollama on a computer in the same network is optional. Every completion mark is read from the actual state of this device; press "Refresh status" after finishing a step to check again.',
            },
            guideStepTitles: {
                ...root.guideStepTitles,
                run_local_server: 'Run the EverTalk app',
                install_ollama: '(Optional) Install and start Ollama on a computer in the same network',
                pull_model: '(Optional) Download a model into Ollama',
            },
            guideStepDescriptions: {
                ...root.guideStepDescriptions,
                run_local_server: 'Complete, because this screen is open in the EverTalk Android app. Chats, memories and settings are stored in the app-internal SQLite database.',
                install_ollama: 'Needed only when you want models larger than this device can run. On a computer in the same network, get the installer from the official site with "Download Ollama" and install it, expose it to the network as in the connection guide below, and save that computer\'s address. Then press "Refresh status" to check the connection.',
                pull_model: 'On the computer running Ollama, open a terminal as described in "How to enter commands" below and type ollama pull model-name. Pick a model from "Browse Ollama models" or "Hugging Face GGUF guide"; entering it in "Model name" of the connection guide below builds the command for you. Press "Refresh status" when the download finishes.',
            },
            memoryGraphSelectHint: 'Pinch with two fingers to zoom, drag empty space to pan, drag nodes to arrange. Tap a keyword or spirit to see the conversations and what the spirit did at the time.',
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
            chatModelModeEmpty: {
                ...root.chatModelModeEmpty,
                on_device: `本设备上目前没有可选择的 GGUF 模型。请在“${formatModelSettingsPath(root)}”中下载或导入 GGUF 模型后再选择。`,
            },
            guidePageDescription: '从什么是 AI 模型，到与精灵的第一次对话，按照本设备的当前状态一步步引导。',
            guideBeginnerIntro: 'EverTalk 使用在本设备内运行的 AI（而不是网上的 AI 服务）来生成精灵的回复。对话内容不会离开设备，应用还内置了一个小型 GGUF 模型，可以立即开始。请先读一遍下面的术语，再从上到下依次完成“按当前状态一步步操作”中的步骤。',
            guideConcepts: [
                root.guideConcepts[0],
                {
                    term: '本地 LLM',
                    description: '不在公司服务器上，而是用本设备的处理器（CPU）和内存直接运行的 AI 模型。没有使用费，对话也不会离开设备，但回复速度和可用的模型大小取决于设备性能。',
                },
                {
                    term: '应用内置设备端 AI（llama.cpp）',
                    description: `本应用内置的 llama.cpp 引擎直接在本设备上运行 GGUF 模型文件。应用自带一个小型 GGUF 模型，无需另外安装即可开始，也可以在“${formatModelSettingsPath(root)}”中下载或导入其他 GGUF 模型。`,
                },
                {
                    term: 'Ollama',
                    description: '在电脑上下载并运行本地 LLM 的免费程序。安装到同一网络中的电脑上，对网络开放并保存其地址后，本应用即可连接，使用比手机能运行的更大、表现力更好的模型。',
                },
                root.guideConcepts[4],
                {
                    term: 'Hugging Face · GGUF',
                    description: `Hugging Face 是发布 AI 模型的网站，GGUF 是本地 LLM 使用的模型文件格式。把 Hugging Face 上 GGUF 文件的地址粘贴到“${formatModelSettingsPath(root)}”的 URL 下载中即可下载到本设备，也可以在电脑上用 ollama pull hf.co/用户/仓库 下载到 Ollama。`,
                },
                {
                    term: 'EverTalk 安卓应用',
                    description: '对话、记忆和设置保存在本应用私有存储区域的 SQLite 数据库中，精灵图片、语音等资源在首次启动时下载并保存在设备上。无需让其他电脑或服务器保持运行。',
                },
            ],
            guideChecklistIntro: {
                ...root.guideChecklistIntro,
                local_server: '本应用通过内置的 llama.cpp 引擎在本设备上运行 GGUF 模型，可以立即开始；连接同一网络中电脑上的 Ollama 是可选步骤。每个完成标记都读取本设备的实际状态，完成步骤后点击“刷新状态”即可重新确认。',
            },
            guideStepTitles: {
                ...root.guideStepTitles,
                run_local_server: '运行 EverTalk 应用',
                install_ollama: '（可选）在同一网络的电脑上安装并启动 Ollama',
                pull_model: '（可选）为 Ollama 下载模型',
            },
            guideStepDescriptions: {
                ...root.guideStepDescriptions,
                run_local_server: '当前画面正在 EverTalk 安卓应用中打开，因此已完成。对话、记忆与设置保存在应用内部 SQLite 数据库中。',
                install_ollama: '只有想使用超出本设备能力的更大模型时才需要。在同一网络的电脑上点击“下载 Ollama”从官方网站获取安装程序并安装，按照下方连接指南对网络开放，并保存那台电脑的地址。然后点击“刷新状态”确认连接。',
                pull_model: '在运行 Ollama 的电脑上，按照下方“如何输入命令”打开终端，输入 ollama pull 模型名称。模型可以在“浏览 Ollama 模型”或“Hugging Face GGUF 指南”中挑选；在下方连接指南的“要使用的模型名称”中输入后会自动生成命令。下载完成后点击“刷新状态”。',
            },
            memoryGraphSelectHint: '双指捏合缩放，拖动空白处平移，拖动节点调整布局。点击关键词或精灵，查看当时的对话与精灵的行动。',
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
        chatModelModeEmpty: {
            ...root.chatModelModeEmpty,
            on_device: `이 기기에서 지금 선택할 수 있는 GGUF 모델이 없습니다. ${formatModelSettingsPath(root)}에서 GGUF 모델을 내려받거나 가져온 뒤 선택하세요.`,
        },
        guidePageDescription: 'AI 모델이 무엇인지부터 정령과 첫 대화를 나누기까지, 지금 이 기기의 상태에 맞춰 차근차근 안내합니다.',
        guideBeginnerIntro: '에버톡은 온라인 AI 서비스가 아니라 이 기기 안에서 돌아가는 AI로 정령의 대답을 씁니다. 대화는 기기 밖으로 나가지 않으며, 앱에 작은 GGUF 모델이 들어 있어 바로 시작할 수 있습니다. 아래 용어를 한 번 읽은 뒤 "지금 내 상태로 따라하기"를 위에서부터 따라 하세요.',
        guideConcepts: [
            root.guideConcepts[0],
            {
                term: '로컬 LLM',
                description: '회사 서버가 아니라 이 기기의 프로세서(CPU)와 메모리로 직접 돌리는 AI 모델입니다. 사용료가 없고 대화가 기기 밖으로 나가지 않지만, 기기 성능에 따라 답변 속도와 쓸 수 있는 모델 크기가 달라집니다.',
            },
            {
                term: '앱 내장 온디바이스 AI (llama.cpp)',
                description: `이 앱에 들어 있는 llama.cpp 엔진이 GGUF 모델 파일을 이 기기에서 직접 실행합니다. 작은 GGUF 모델이 앱에 함께 들어 있어 따로 설치할 것 없이 바로 시작할 수 있고, ${formatModelSettingsPath(root)}에서 다른 GGUF 모델을 내려받거나 가져올 수 있습니다.`,
            },
            {
                term: 'Ollama (올라마)',
                description: '컴퓨터에서 로컬 LLM을 내려받고 실행해 주는 무료 프로그램입니다. 같은 네트워크의 컴퓨터에 설치하고 네트워크에 공개한 뒤 그 주소를 저장하면, 이 앱이 연결해 휴대폰에서 돌리기 어려운 더 크고 표현력이 좋은 모델을 쓸 수 있습니다.',
            },
            root.guideConcepts[4],
            {
                term: 'Hugging Face · GGUF',
                description: `Hugging Face는 AI 모델이 공개되는 사이트이고, GGUF는 로컬 LLM용 모델 파일 형식입니다. Hugging Face의 GGUF 파일 주소를 ${formatModelSettingsPath(root)}의 URL 내려받기에 넣으면 이 기기로 바로 받을 수 있고, 컴퓨터의 Ollama에는 ollama pull hf.co/사용자/저장소 명령으로 받을 수 있습니다.`,
            },
            {
                term: '에버톡 안드로이드 앱',
                description: '대화·기억·설정은 이 앱 전용 저장 영역의 SQLite 데이터베이스에 저장되고, 정령 이미지·음성 같은 에셋은 처음 실행할 때 내려받아 기기에 보관합니다. 다른 컴퓨터나 서버를 켜 둘 필요가 없습니다.',
            },
        ],
        guideChecklistIntro: {
            ...root.guideChecklistIntro,
            local_server: '이 앱은 앱에 내장된 llama.cpp 엔진으로 이 기기에서 GGUF 모델을 실행하므로 바로 시작할 수 있고, 같은 네트워크 컴퓨터의 Ollama 연결은 선택 단계입니다. 각 단계의 완료 표시는 이 기기의 실제 상태를 읽어서 보여 주며, 단계를 마친 뒤 "상태 새로고침"을 누르면 다시 확인합니다.',
        },
        guideStepTitles: {
            ...root.guideStepTitles,
            run_local_server: '에버톡 앱 실행',
            install_ollama: '(선택) 같은 네트워크의 컴퓨터에 Ollama 설치하고 켜기',
            pull_model: '(선택) Ollama에 대화용 모델 받기',
        },
        guideStepDescriptions: {
            ...root.guideStepDescriptions,
            run_local_server: '지금 이 화면이 에버톡 안드로이드 앱에서 열려 있으므로 완료입니다. 대화·기억·설정은 앱 내부 SQLite 데이터베이스에 저장됩니다.',
            install_ollama: '이 기기에서 돌리기 어려운 큰 모델을 쓰고 싶을 때만 필요합니다. 같은 네트워크의 컴퓨터에서 "Ollama 내려받기"로 공식 사이트의 설치 파일을 받아 설치하고, 아래 연결 가이드대로 네트워크에 공개한 뒤 그 컴퓨터의 주소를 저장하세요. 그다음 "상태 새로고침"을 누르면 연결을 확인합니다.',
            pull_model: 'Ollama를 실행하는 컴퓨터에서 아래 "명령어 입력하는 법"대로 터미널을 열고 ollama pull 모델이름 을 입력합니다. 모델은 "Ollama 모델 찾아보기"나 "Hugging Face GGUF 안내"에서 고르고, 아래 연결 가이드의 "사용할 모델 이름"에 넣으면 명령이 자동으로 만들어집니다. 받기가 끝나면 "상태 새로고침"을 누르세요.',
        },
        memoryGraphSelectHint: '두 손가락으로 벌리거나 모아 확대·축소, 빈 곳을 끌어 이동, 노드를 끌어 배치합니다. 키워드나 정령을 누르면 그때 나눈 대화와 정령의 행동이 표시됩니다.',
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
            storyMoviePlay: 'Play video',
            storyMoviePause: 'Pause video',
            storyMoviePosition: 'Video position',
            storyMovieMute: 'Mute',
            storyMovieUnmute: 'Unmute',
            ollamaHostPlatformTitle: 'Operating system of the computer running Ollama',
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
            storyMoviePlay: '播放视频',
            storyMoviePause: '暂停视频',
            storyMoviePosition: '视频播放位置',
            storyMovieMute: '静音',
            storyMovieUnmute: '取消静音',
            ollamaHostPlatformTitle: '运行 Ollama 的电脑的操作系统',
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
        storyMoviePlay: '영상 재생',
        storyMoviePause: '영상 일시정지',
        storyMoviePosition: '영상 재생 위치',
        storyMovieMute: '음소거',
        storyMovieUnmute: '음소거 해제',
        ollamaHostPlatformTitle: 'Ollama를 실행하는 컴퓨터의 운영체제',
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
