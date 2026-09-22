import type { SpiritSkinVisualAsset } from '../../persona';
import { formatSkinLabel } from '../logic';
import type { EverTalkLabels } from '../i18n';
import { LoadableAssetImage } from './LoadableAssetImage';

export interface SpiritSkinPickerProps {
    skinOptions: SpiritSkinVisualAsset[];
    activeSkinId: string | undefined;
    spiritName: string;
    labels: EverTalkLabels;
    onSelectSkin: (skinId: string) => Promise<void>;
}

export function SpiritSkinPicker({ skinOptions, activeSkinId, spiritName, labels, onSelectSkin }: SpiritSkinPickerProps) {
    if (skinOptions.length <= 1) {
        return null;
    }
    return (
        <div className="ever-skin-grid" aria-label={labels.skinSelector(spiritName)}>
            {skinOptions.map((skin) => (
                <button key={skin.id} type="button" className={skin.id === activeSkinId ? 'is-active' : ''} aria-pressed={skin.id === activeSkinId} onClick={() => void onSelectSkin(skin.id)}>
                    <LoadableAssetImage candidates={skin.thumbnailCandidates} alt="" className="ever-skin-thumb" fallback={<span className="ever-skin-thumb is-empty"/>}/>
                    <span>{formatSkinLabel(skin, labels)}</span>
                </button>
            ))}
        </div>
    );
}
