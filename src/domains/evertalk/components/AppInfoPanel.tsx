import developerAvatar from '../../../assets/developer-avatar.png';
import type { AppInfoPanelProps } from '../types';

const DEVELOPER_NAME = 'GarnetRapture';
const CONTACT_EMAIL = 'garnet@everlib.pro';
const WEBSITE_URL = 'https://n9k32.com/';

export function AppInfoPanel({ labels }: AppInfoPanelProps) {
    return (
        <section className="ever-panel-section ever-app-info">
            <h3>{labels.appInfoTitle}</h3>
            <div className="ever-app-info__profile">
                <img
                    className="ever-app-info__avatar"
                    src={developerAvatar}
                    alt={DEVELOPER_NAME}
                    width={56}
                    height={56}
                />
                <div className="ever-app-info__identity">
                    <small>{labels.appInfoDeveloper}</small>
                    <strong>{DEVELOPER_NAME}</strong>
                </div>
            </div>
            <div className="ever-app-info__row">
                <span>{labels.appInfoContact}</span>
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </div>
            <div className="ever-app-info__row">
                <span>{labels.appInfoWebsite}</span>
                <a href={WEBSITE_URL} target="_blank" rel="noreferrer">{WEBSITE_URL}</a>
            </div>
        </section>
    );
}
