import type { ButtonHTMLAttributes } from 'react';
import { storyUiUrl } from './client';

interface StoryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    icon?: 'icon_log2' | 'icon_skip2' | 'icon_autobattle' | 'icon_eye';
    active?: boolean;
}

export function StoryButton({ icon, active = false, children, className = '', ...props }: StoryButtonProps) {
    return (
        <button {...props} type="button" className={`ever-story__button${active ? ' is-active' : ''} ${className}`}>
            {icon === undefined ? null : (
                <span className="ever-story__button-icon">
                    <img className="ever-story__button-icon-bg" src={storyUiUrl('btn_hexa50')} alt="" />
                    <img className="ever-story__button-icon-frame" src={storyUiUrl('btn_hexa50line')} alt="" />
                    <img className="ever-story__button-icon-glyph" src={storyUiUrl(icon)} alt="" />
                </span>
            )}
            <span className="ever-story__button-label">{children}</span>
        </button>
    );
}
