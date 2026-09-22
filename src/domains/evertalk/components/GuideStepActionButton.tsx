import { BookOpen, Download, ExternalLink, MessageCircle, RefreshCw, Settings } from 'lucide-react';
import { EVAI_REPOSITORY_URL } from '../../../shared/host';
import { HUGGING_FACE_OLLAMA_GUIDE_URL, OLLAMA_DOWNLOAD_URL, OLLAMA_MODEL_LIBRARY_URL } from '../../ollama';
import type { GuideStepActionButtonProps } from '../types';

export function GuideStepActionButton({ action, controller }: GuideStepActionButtonProps) {
    const { labels } = controller;
    const title = labels.guideActionLabels[action];
    if (action === 'open_ollama_download' || action === 'open_ollama_library' || action === 'open_hugging_face_guide' || action === 'open_repository') {
        const href = action === 'open_ollama_download' ? OLLAMA_DOWNLOAD_URL
            : action === 'open_ollama_library' ? OLLAMA_MODEL_LIBRARY_URL
                : action === 'open_hugging_face_guide' ? HUGGING_FACE_OLLAMA_GUIDE_URL
                    : EVAI_REPOSITORY_URL;
        return (
            <a className="ever-guide-step__action" href={href} target="_blank" rel="noreferrer noopener">
                {action === 'open_ollama_download' ? <Download aria-hidden="true" size={14}/> : <ExternalLink aria-hidden="true" size={14}/>}
                {title}
            </a>
        );
    }
    if (action === 'refresh_status') {
        return (
            <button type="button" className="ever-guide-step__action" disabled={controller.modelCatalogRefreshing} onClick={() => void controller.refreshModelCatalog()}>
                <RefreshCw aria-hidden="true" size={14} className={controller.modelCatalogRefreshing ? 'is-spinning' : ''}/>
                {controller.modelCatalogRefreshing ? labels.checking : title}
            </button>
        );
    }
    if (action === 'open_settings') {
        return (
            <button type="button" className="ever-guide-step__action" onClick={() => void controller.openSettings()}>
                <Settings aria-hidden="true" size={14}/>
                {title}
            </button>
        );
    }
    if (action === 'choose_model') {
        return (
            <button type="button" className="ever-guide-step__action" onClick={() => void (controller.gatePending ? controller.navigateWorkspace('chat') : controller.openSettings())}>
                <BookOpen aria-hidden="true" size={14}/>
                {title}
            </button>
        );
    }
    return (
        <button type="button" className="ever-guide-step__action" onClick={() => void controller.navigateWorkspace('chat')}>
            <MessageCircle aria-hidden="true" size={14}/>
            {title}
        </button>
    );
}
