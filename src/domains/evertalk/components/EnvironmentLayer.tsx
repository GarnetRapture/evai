import { useEffect, useState } from 'react';
import { Bell, ChevronDown, Cpu, Database, FlaskConical, HardDrive, Home, MessageCircle, Settings, Trophy, UserRound, Workflow, X } from 'lucide-react';
import type { DeviceEnvironmentInfo } from '../../../shared/platform';
import type { UserSession } from '../../auth';
import type { AppSettings } from '../../settings';
import type { NativeContextStatus } from '../../native';
import type { EverTalkLabels } from '../i18n';
import type { SaviorProfileSnapshot, WorkspaceView } from '../types';

interface EnvironmentLayerProps {
    settings: AppSettings | null;
    session: UserSession | null;
    savior: SaviorProfileSnapshot;
    environment: DeviceEnvironmentInfo | null;
    nativeStatus: NativeContextStatus;
    labels: EverTalkLabels;
    embedded?: boolean;
    notificationItems?: Array<{ personaId: string; name: string; count: number }>;
    onOpenNotification?: (personaId: string) => void;
    activeView?: WorkspaceView;
    onNavigate?: (view: WorkspaceView) => void;
    onOpenLobby?: () => void;
    onOpenSettings?: () => void;
}

export function EnvironmentLayer({ settings, session, savior, environment, nativeStatus, labels, embedded = false, notificationItems = [], onOpenNotification, activeView = 'chat', onNavigate, onOpenLobby, onOpenSettings }: EnvironmentLayerProps) {
    const [open, setOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const notificationTotal = notificationItems.reduce((sum, item) => sum + item.count, 0);
    const profileName = savior.saviorName || session?.username || labels.saviorDefaultName;
    const nativeSelected = settings?.context_storage_mode === 'native_mirror';
    const browser = environment ? `${environment.browser.browser} ${environment.browser.version}`.trim() : labels.checking;
    const device = environment
        ? [environment.browser.platform, environment.browser.platform_version, environment.browser.architecture, environment.browser.bitness ? `${environment.browser.bitness}-bit` : ''].filter(Boolean).join(' · ')
        : labels.checking;
    const gpu = environment?.webgpu.available
        ? `${labels.webGpuAvailable}${environment.webgpu.adapter ? ` · ${environment.webgpu.adapter}` : ''}`
        : labels.webGpuUnavailable;
    const details = (
        <div className="ever-environment-layer__details">
            <div className="ever-environment-layer__details-header">
                <h2>{labels.environmentTitle}</h2>
                {!embedded && (
                    <button type="button" aria-label={labels.close} onClick={() => setOpen(false)}>
                        <X size={18}/>
                    </button>
                )}
            </div>
            <dl>
                <div><dt>{labels.userProfile}</dt><dd>{profileName}{session?.email ? ` · ${session.email}` : ''}</dd></div>
                <div><dt>{labels.contextStorage}</dt><dd>{nativeSelected ? labels.nativeMirrorStorage : labels.browserStorage}</dd></div>
                <div><dt>{labels.browserInfo}</dt><dd>{browser}</dd></div>
                <div><dt>{labels.deviceProfile}</dt><dd>{device}</dd></div>
                <div><dt>{labels.webGpuInfo}</dt><dd>{gpu}</dd></div>
                {nativeStatus.health ? <div><dt>{labels.nativeExecutablePath}</dt><dd>{nativeStatus.health.executable_path}</dd></div> : null}
                {nativeStatus.health ? <div><dt>{labels.nativeDatabasePath}</dt><dd>{nativeStatus.health.database_path}</dd></div> : null}
                {nativeStatus.health ? <div><dt>{labels.databaseFileSize}</dt><dd>{new Intl.NumberFormat(labels.localeTag).format(nativeStatus.health.database_bytes)} B</dd></div> : null}
                {Number.isInteger(nativeStatus.health?.process_id) ? <div><dt>{labels.nativeProcessId}</dt><dd>{nativeStatus.health?.process_id}</dd></div> : null}
                {nativeStatus.health ? <div><dt>{labels.nativeRuntimePolicy}</dt><dd>{labels.nativeRuntimePolicyValue}</dd></div> : null}
            </dl>
        </div>
    );
    useEffect(() => {
        if (!open && !notificationsOpen) return undefined;
        function closeOnEscape(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setOpen(false);
                setNotificationsOpen(false);
            }
        }
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [open, notificationsOpen]);
    if (embedded) return <div className="ever-environment-embedded">{details}</div>;
    return (
        <>
            <div className="ever-environment-layer">
                <button
                    type="button"
                    className={`ever-notification-layer__trigger ${notificationTotal > 0 ? 'has-unread' : ''}`}
                    aria-label={notificationTotal > 0 ? `${labels.notifications}: ${labels.proactiveUnreadCount(notificationTotal)}` : labels.notifications}
                    aria-expanded={notificationsOpen}
                    aria-haspopup="dialog"
                    onClick={() => {
                        setOpen(false);
                        setNotificationsOpen((current) => !current);
                    }}
                >
                    <Bell size={16} aria-hidden="true"/>
                    <span>{labels.notifications}</span>
                    {notificationTotal > 0 && <b>{notificationTotal > 99 ? '99+' : notificationTotal}</b>}
                </button>
                <nav className="ever-top-navigation" aria-label={labels.rosterTitle}>
                    {([
                        ['chat', labels.navChat, MessageCircle],
                        ['ranking', labels.navRanking, Trophy],
                        ['memory', labels.navMemory, Workflow],
                        ['storage', labels.navStorage, HardDrive],
                        ...(settings?.cheat_mode_enabled ? [['cheat', labels.navCheat, FlaskConical]] as const : []),
                    ] as const).map(([view, title, Icon]) => (
                        <button key={view} type="button" className={activeView === view ? 'is-active' : ''} aria-current={activeView === view ? 'page' : undefined} onClick={() => {
                            setOpen(false);
                            setNotificationsOpen(false);
                            onNavigate?.(view);
                        }}><Icon size={15}/><span>{title}</span></button>
                    ))}
                    <button type="button" onClick={() => { setOpen(false); setNotificationsOpen(false); onOpenLobby?.(); }}><Home size={15}/><span>{labels.lobby}</span></button>
                    <button type="button" onClick={() => { setOpen(false); setNotificationsOpen(false); onOpenSettings?.(); }}><Settings size={15}/><span>{labels.settings}</span></button>
                </nav>
                <button
                    type="button"
                    className="ever-environment-layer__trigger"
                    aria-expanded={open}
                    aria-haspopup="dialog"
                    onClick={() => {
                        setNotificationsOpen(false);
                        setOpen((current) => !current);
                    }}
                >
                    <span className="ever-environment-layer__profile"><UserRound size={14}/>{profileName}</span>
                    <span className="ever-environment-layer__browser"><Cpu size={14}/>{browser}</span>
                    <span className={nativeSelected ? (nativeStatus.available ? 'is-ready' : 'is-warning') : ''}>
                        <Database size={14}/>{nativeSelected && nativeStatus.available ? labels.nativeContextReady : labels.browserStorage}
                    </span>
                    <ChevronDown className={open ? 'is-open' : ''} size={15} aria-hidden="true"/>
                </button>
            </div>
            {open && (
                <div
                    className="ever-environment-overlay"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setOpen(false);
                    }}
                >
                    <section className="ever-environment-overlay__panel" role="dialog" aria-modal="true" aria-label={labels.environmentTitle}>
                        {details}
                    </section>
                </div>
            )}
            {notificationsOpen && (
                <div
                    className="ever-environment-overlay is-notification"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setNotificationsOpen(false);
                    }}
                >
                    <section className="ever-notification-layer__panel" role="dialog" aria-modal="true" aria-label={labels.notifications}>
                        <header>
                            <h2><Bell size={17} aria-hidden="true"/>{labels.notifications}</h2>
                            <button type="button" aria-label={labels.close} onClick={() => setNotificationsOpen(false)}><X size={18}/></button>
                        </header>
                        {notificationItems.length === 0 ? <p>{labels.noNotifications}</p> : (
                            <div className="ever-notification-layer__list">
                                {notificationItems.map((item) => (
                                    <button key={item.personaId} type="button" onClick={() => {
                                        setNotificationsOpen(false);
                                        onOpenNotification?.(item.personaId);
                                    }}>
                                        <strong>{item.name}</strong>
                                        <span>{labels.proactiveUnreadCount(item.count)}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        <small>{labels.proactiveNotificationHint}</small>
                    </section>
                </div>
            )}
        </>
    );
}
