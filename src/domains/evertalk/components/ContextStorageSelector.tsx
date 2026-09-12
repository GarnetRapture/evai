import { useId, useRef } from 'react';
import type { ContextStorageMode, NativeContextStatus } from '../../native';
import type { EverTalkLabels } from '../i18n';

interface ContextStorageSelectorProps {
    mode: ContextStorageMode;
    status: NativeContextStatus;
    executablePath: string;
    labels: EverTalkLabels;
    onChange: (mode: ContextStorageMode) => Promise<void>;
    onExecutablePathChange: (path: string) => Promise<void>;
    onConnect: () => Promise<void>;
}

export function ContextStorageSelector({ mode, status, executablePath, labels, onChange, onExecutablePathChange, onConnect }: ContextStorageSelectorProps) {
    const pathInputId = useId();
    const pathInputRef = useRef<HTMLInputElement>(null);
    async function connectNativeProgram() {
        try {
            const nextPath = pathInputRef.current?.value.trim() ?? executablePath;
            if (nextPath !== executablePath) await onExecutablePathChange(nextPath);
            await onConnect();
        }
        catch {
            // The controller publishes the localized validation/connection failure.
        }
    }
    const statusDetail = status.detail === 'native_executable_path_mismatch'
        ? labels.nativeExecutablePathMismatch
        : status.detail === 'native_host_path_not_found' || status.detail === 'native_host_not_found'
            ? labels.nativeExecutablePathNotFound
            : status.detail;
    return (
        <section className="ever-context-storage">
            <h3>{labels.contextStorage}</h3>
            <label className={mode === 'browser' ? 'is-active' : ''}>
                <input type="radio" name="context-storage" checked={mode === 'browser'} onChange={() => void onChange('browser')}/>
                <span><strong>{labels.browserStorage}</strong><small>{labels.browserStorageDescription}</small></span>
            </label>
            <label className={mode === 'native_mirror' ? 'is-active' : ''}>
                <input type="radio" name="context-storage" checked={mode === 'native_mirror'} onChange={() => void onChange('native_mirror')}/>
                <span><strong>{labels.nativeMirrorStorage}</strong><small>{labels.nativeMirrorStorageDescription}</small></span>
            </label>
            {mode === 'native_mirror' && (
                <>
                    <div className="ever-context-storage__path">
                        <label htmlFor={pathInputId}>{labels.nativeExecutablePath}</label>
                        <input
                            key={executablePath}
                            ref={pathInputRef}
                            id={pathInputId}
                            type="text"
                            defaultValue={executablePath}
                            placeholder={labels.nativeExecutablePathPlaceholder}
                            autoComplete="off"
                            spellCheck={false}
                            onKeyDown={(event) => {
                                if (event.key !== 'Enter') return;
                                event.preventDefault();
                                void connectNativeProgram();
                            }}
                        />
                        <small>{labels.nativeExecutablePathDescription}</small>
                    </div>
                    <div className={`ever-context-storage__health ${status.available ? 'is-ready' : 'is-warning'}`}>
                        <span>{status.available ? labels.nativeContextReady : labels.nativeContextUnavailable}</span>
                        <button type="button" onClick={() => void connectNativeProgram()}>{labels.connectNativeProgram}</button>
                    </div>
                    {!status.available && status.detail !== 'not_checked' ? <small className="ever-context-storage__detail">{statusDetail}</small> : null}
                    {status.health ? (
                        <dl>
                            <div><dt>{labels.nativeExecutablePath}</dt><dd>{status.health.executable_path}</dd></div>
                            <div><dt>{labels.nativeDatabasePath}</dt><dd>{status.health.database_path}</dd></div>
                            {Number.isInteger(status.health.process_id) ? <div><dt>{labels.nativeProcessId}</dt><dd>{status.health.process_id}</dd></div> : null}
                        </dl>
                    ) : null}
                </>
            )}
        </section>
    );
}
