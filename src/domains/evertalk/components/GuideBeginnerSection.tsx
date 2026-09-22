import { CheckCircle2, Circle, CircleDot, Loader2, PlusCircle, type LucideIcon } from 'lucide-react';
import { buildGuideChecklist } from '../logic';
import type { GuideStepState, WorkspacePageProps } from '../types';
import { GuideStepActionButton } from './GuideStepActionButton';

const GUIDE_STEP_STATE_ICONS: Record<GuideStepState, LucideIcon> = {
    checking: Loader2,
    done: CheckCircle2,
    current: CircleDot,
    todo: Circle,
    optional: PlusCircle,
};

export function GuideBeginnerSection({ controller }: WorkspacePageProps) {
    const { labels } = controller;
    const path = controller.hostRuntime.kind;
    const steps = buildGuideChecklist({
        path,
        catalog: controller.modelCatalog,
        activeModelId: controller.appSettings?.active_model ?? '',
        llmStatus: controller.llmStatus,
        gatePending: controller.gatePending,
    });
    return (
        <>
            <section className="ever-guide-page__card ever-guide-concepts" aria-labelledby="guide-beginner-title">
                <h2 id="guide-beginner-title">{labels.guideBeginnerTitle}</h2>
                <p>{labels.guideBeginnerIntro}</p>
                <dl className="ever-guide-concepts__list">
                    {labels.guideConcepts.map((concept) => (
                        <div key={concept.term}>
                            <dt>{concept.term}</dt>
                            <dd>{concept.description}</dd>
                        </div>
                    ))}
                </dl>
            </section>
            <section className="ever-guide-page__card ever-guide-checklist" aria-labelledby="guide-checklist-title">
                <h2 id="guide-checklist-title">{labels.guideChecklistTitle}</h2>
                <p>{labels.guideChecklistIntro[path]}</p>
                <ol className="ever-guide-checklist__steps">
                    {steps.map((step, index) => {
                        const Icon = GUIDE_STEP_STATE_ICONS[step.state];
                        return (
                            <li key={step.key} className={`ever-guide-step is-${step.state}`}>
                                <span className="ever-guide-step__marker" aria-hidden="true">
                                    <Icon size={20} className={step.state === 'checking' ? 'is-spinning' : ''}/>
                                </span>
                                <div className="ever-guide-step__body">
                                    <div className="ever-guide-step__head">
                                        <strong>{index + 1}. {labels.guideStepTitles[step.key]}</strong>
                                        <em>{labels.guideStepStates[step.state]}</em>
                                    </div>
                                    <p>{labels.guideStepDescriptions[step.key]}</p>
                                    {step.actions.length > 0 && step.state !== 'done' ? (
                                        <div className="ever-guide-step__actions">
                                            {step.actions.map((action) => <GuideStepActionButton key={action} action={action} controller={controller}/>)}
                                        </div>
                                    ) : null}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </section>
        </>
    );
}
