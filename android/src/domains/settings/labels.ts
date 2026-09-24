import type {Language} from '../../shared/native';

const translations = {
  ko: {
    app: '에버소울 AI 채팅', lobby: '로비', spirits: '정령', chat: '대화', story: '이야기', memory: '기억', settings: '설정',
    search: '정령 검색', empty: '표시할 내용이 없습니다.', loading: '불러오는 중…', send: '보내기', cancel: '중단',
    messageHint: '구원자의 말을 입력하세요', model: '로컬 모델', importModel: 'GGUF 가져오기', loadModel: '모델 로드',
    noModel: '모델을 먼저 가져와 주세요.', noSpirit: '정령을 선택해 주세요.', newChat: '새 대화', history: '대화 기록', deleteModel: '삭제', confirmDeleteModel: '선택한 GGUF 모델을 삭제할까요?',
    profile: '정령 소개', language: '언어', storage: '저장소', noStory: '이야기 자료가 없습니다.',
    readiness: '모바일 앱 상태', modelReady: '모델 준비됨', modelMissing: '모델 미설정', data: '정령 데이터', guide: '시작 안내',
    guideModel: '설정에서 기기의 GGUF 모델 파일을 가져오고 로드하세요.', guideSpirit: '정령 목록에서 대화할 정령을 고르세요.', guideChat: '대화는 이 기기에 저장되며 매 턴 저장된 기록으로 맥락을 구성합니다.',
  },
  en: {
    app: 'EverSoul AI Chat', lobby: 'Lobby', spirits: 'Spirits', chat: 'Chat', story: 'Story', memory: 'Memory', settings: 'Settings',
    search: 'Search spirits', empty: 'Nothing to show.', loading: 'Loading…', send: 'Send', cancel: 'Cancel',
    messageHint: 'Say something to her', model: 'Local model', importModel: 'Import GGUF', loadModel: 'Load model',
    noModel: 'Import a model first.', noSpirit: 'Choose a spirit.', newChat: 'New chat', history: 'Chat history', deleteModel: 'Delete', confirmDeleteModel: 'Delete the selected GGUF model?',
    profile: 'Spirit profile', language: 'Language', storage: 'Storage', noStory: 'No story data.',
    readiness: 'Mobile app status', modelReady: 'Model ready', modelMissing: 'No model selected', data: 'Spirit data', guide: 'Getting started',
    guideModel: 'Import a GGUF model from this device in Settings and load it.', guideSpirit: 'Choose a spirit from the roster.', guideChat: 'Chats stay on this device; each turn derives context from stored history.',
  },
  zh_cn: {
    app: '永恒灵魂 AI 聊天', lobby: '大厅', spirits: '精灵', chat: '聊天', story: '故事', memory: '记忆', settings: '设置',
    search: '搜索精灵', empty: '暂无内容。', loading: '加载中…', send: '发送', cancel: '取消',
    messageHint: '对她说些什么', model: '本地模型', importModel: '导入 GGUF', loadModel: '加载模型',
    noModel: '请先导入模型。', noSpirit: '请选择精灵。', newChat: '新对话', history: '聊天记录', deleteModel: '删除', confirmDeleteModel: '删除所选的 GGUF 模型吗？',
    profile: '精灵资料', language: '语言', storage: '存储', noStory: '暂无故事资料。',
    readiness: '移动应用状态', modelReady: '模型已准备', modelMissing: '未选择模型', data: '精灵数据', guide: '入门指南',
    guideModel: '在设置中导入设备上的 GGUF 模型文件并加载。', guideSpirit: '在精灵列表中选择聊天对象。', guideChat: '对话保存在本设备上；每一轮都从已存记录构建上下文。',
  },
} as const;

export function labels(language: Language) {
  return translations[language];
}
