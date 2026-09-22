import { X } from 'lucide-react';
import type { ProfileDetailPanelProps } from '../types';

function listValue(items: string[]): string {
    return items.length > 0 ? items.join(', ') : '-';
}

export function ProfileDetailPanel({ open, activeDetail, labels, onClose }: ProfileDetailPanelProps) {
    if (!open || !activeDetail) {
        return null;
    }

    const profile = activeDetail.profile;
    const evertalkExamples = activeDetail.dialogues?.evertalk?.slice(0, 8) ?? [];

    return (<div className="ever-settings-overlay" role="dialog" aria-modal="true">
      <div className="ever-profile-detail-modal">
        <header className="ever-settings-modal__header">
          <div>
            <p className="ever-kicker">{labels.profileDetail}</p>
            <h2>{activeDetail.name}</h2>
            <span>{activeDetail.name_en}</span>
          </div>
          <button type="button" aria-label={labels.close} onClick={onClose}>
            <X aria-hidden="true" size={20}/>
          </button>
        </header>
        <section className="ever-profile-detail-grid">
          <div><small>{labels.grade}</small><strong>{activeDetail.grade}</strong></div>
          <div><small>{labels.race}</small><strong>{activeDetail.race}</strong></div>
          <div><small>{labels.className}</small><strong>{activeDetail.class}</strong></div>
          <div><small>{labels.subClass}</small><strong>{activeDetail.sub_class}</strong></div>
          <div><small>{labels.stat}</small><strong>{activeDetail.stat}</strong></div>
          <div><small>{labels.union}</small><strong>{profile.union ?? '-'}</strong></div>
          <div><small>{labels.constellation}</small><strong>{profile.constellation ?? '-'}</strong></div>
          <div><small>{labels.birthday}</small><strong>{profile.birthday ?? '-'}</strong></div>
          <div><small>{labels.height}</small><strong>{profile.height ? `${profile.height}` : '-'}</strong></div>
          <div><small>{labels.weight}</small><strong>{profile.weight ? `${profile.weight}` : '-'}</strong></div>
          <div><small>{labels.cvKo}</small><strong>{profile.cv_ko ?? '-'}</strong></div>
          <div><small>{labels.cvJp}</small><strong>{profile.cv_jp ?? '-'}</strong></div>
        </section>
        <section className="ever-panel-section">
          <h3>{labels.personality}</h3>
          <p>{activeDetail.personality.description ?? activeDetail.personality.greeting ?? '-'}</p>
        </section>
        <section className="ever-profile-detail-grid">
          <div><small>{labels.like}</small><strong>{listValue(profile.like)}</strong></div>
          <div><small>{labels.dislike}</small><strong>{listValue(profile.dislike)}</strong></div>
          <div><small>{labels.hobby}</small><strong>{listValue(profile.hobby)}</strong></div>
          <div><small>{labels.speciality}</small><strong>{listValue(profile.speciality)}</strong></div>
        </section>
        <section className="ever-panel-section">
          <h3>{labels.dialogueExamples}</h3>
          <div className="ever-profile-detail-dialogues">
            {evertalkExamples.map((dialogue, index) => (<div key={`${dialogue.speaker}-${index}`}>
                <small>{dialogue.speaker}</small>
                <span>{dialogue.message}</span>
              </div>))}
          </div>
        </section>
      </div>
    </div>);
}
