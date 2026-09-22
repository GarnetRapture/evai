import { BookOpen, Terminal } from 'lucide-react';
import { resolveOllamaCommandShell } from '../../ollama';
import type { WorkspacePageProps } from '../types';
import { GuideBeginnerSection } from './GuideBeginnerSection';
import { LocalServerNotice } from './LocalServerNotice';
import { OllamaConnectionGuide } from './OllamaConnectionGuide';
import { WorkspaceSurface } from './WorkspaceSurface';

export function GuidePage({ controller }: WorkspacePageProps) {
    const { labels } = controller;
    return (
        <WorkspaceSurface controller={controller} labelledBy="guide-page-title">
            <header className="ever-workspace-page__header">
                <div><p>{labels.navGuide}</p><h1 id="guide-page-title">{labels.guidePageTitle}</h1><span>{labels.guidePageDescription}</span></div>
                <BookOpen size={34} aria-hidden="true"/>
            </header>
            <div className="ever-guide-page__sections">
                <GuideBeginnerSection controller={controller}/>
                {controller.localServerNoticeVisible ? <LocalServerNotice labels={labels}/> : null}
                {controller.ollamaGuideVisible ? (
                    <section className="ever-guide-page__card ever-guide-terminal" aria-labelledby="guide-terminal-title">
                        <h2 id="guide-terminal-title"><Terminal aria-hidden="true" size={18}/>{labels.guideTerminalTitle}</h2>
                        <ol>
                            {labels.guideTerminalSteps[resolveOllamaCommandShell(controller.devicePlatform)].map((step) => <li key={step}>{step}</li>)}
                        </ol>
                    </section>
                ) : null}
                {controller.ollamaGuideVisible ? (
                    <div className="ever-guide-page__card">
                        <OllamaConnectionGuide
                            library={controller.modelCatalog?.ollama ?? null}
                            checking={controller.modelCatalogRefreshing}
                            introVisible
                            platform={controller.devicePlatform}
                            labels={labels}
                            onCheck={controller.refreshModelCatalog}
                        />
                    </div>
                ) : null}
            </div>
        </WorkspaceSurface>
    );
}
