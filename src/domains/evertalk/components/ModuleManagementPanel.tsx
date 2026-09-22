import { Box, Download, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ModuleControl } from '../../modules';
import { formatModuleControlLabel, formatModuleControlOption, formatModuleControlValue } from '../logic';
import type { ModuleManagementPanelProps } from '../types';

export function ModuleManagementPanel({
    open: isOpen,
    modules,
    moduleBusy,
    moduleError,
    moduleMessage,
    labels,
    onClose,
    onImportModule,
    onSetModuleEnabled,
    onUpdateModuleControls,
    onDeleteModule,
}: ModuleManagementPanelProps) {
    const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
    const activeModule = useMemo(
        () => modules.find((module) => module.id === activeModuleId) ?? modules[0],
        [activeModuleId, modules],
    );

    if (!isOpen) {
        return null;
    }

    async function updateControl(control: ModuleControl, value: string) {
        if (!activeModule) {
            return;
        }
        const controls = activeModule.controls.map((item) =>
            item.id === control.id ? { ...item, value } : item,
        );
        await onUpdateModuleControls(activeModule.id, controls);
    }

    return (
        <div className="ever-settings-overlay" role="dialog" aria-modal="true">
            <div className="ever-module-management">
                <header className="ever-settings-modal__header">
                    <h2>{labels.moduleManagement}</h2>
                    <button type="button" aria-label={labels.close} onClick={onClose}>
                        <X aria-hidden="true" size={20} />
                    </button>
                </header>

                <div className="ever-module-management__layout">
                    <aside className="ever-module-management__sidebar">
                        <button
                            type="button"
                            className="ever-settings-reset-button"
                            disabled={moduleBusy}
                            onClick={() => void onImportModule()}
                        >
                            <Download aria-hidden="true" size={16} />
                            {moduleBusy ? labels.moduleImporting : labels.moduleImportAction}
                        </button>

                        <div className="ever-module-management__list">
                            {modules.length === 0 ? (
                                <div className="ever-settings-result">
                                    <span>{labels.moduleEmptyList}</span>
                                </div>
                            ) : modules.map((module) => (
                                <button
                                    key={module.id}
                                    type="button"
                                    className={module.id === activeModule?.id ? 'is-active' : ''}
                                    onClick={() => setActiveModuleId(module.id)}
                                >
                                    <Box aria-hidden="true" size={16} />
                                    <span>
                                        <strong>{module.name}</strong>
                                        <small>{labels.moduleControlsCount(module.controls.length, module.lorebook_count)}</small>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </aside>

                    <main className="ever-module-management__content">
                        {activeModule ? (
                            <>
                                <section className="ever-module-management__hero">
                                    <div>
                                        <h3>{activeModule.name}</h3>
                                        <p>{activeModule.description || activeModule.source_path || labels.moduleNoDescription}</p>
                                    </div>
                                    <label className="ever-module-management__enabled">
                                        <input
                                            type="checkbox"
                                            checked={activeModule.enabled}
                                            disabled={moduleBusy}
                                            onChange={(event) => void onSetModuleEnabled(activeModule.id, event.target.checked)}
                                        />
                                        <span>{activeModule.enabled ? labels.moduleEnabled : labels.moduleDisabled}</span>
                                    </label>
                                </section>

                                <section className="ever-module-management__controls">
                                    {activeModule.controls.length === 0 ? (
                                        <div className="ever-settings-result">
                                            <span>{labels.moduleNoControls}</span>
                                        </div>
                                    ) : activeModule.controls.map((control) => (
                                        <div className="ever-module-control" key={control.id}>
                                            <label>
                                                <span>{formatModuleControlLabel(control, labels)}</span>
                                                <small>{control.id}</small>
                                            </label>
                                            {control.kind === 'boolean' && (
                                                <button
                                                    type="button"
                                                    className={control.value === '1' ? 'is-on' : ''}
                                                    onClick={() => void updateControl(control, control.value === '1' ? '0' : '1')}
                                                >
                                                    {formatModuleControlValue(control, labels)}
                                                </button>
                                            )}
                                            {control.kind === 'select' && (
                                                <select
                                                    value={control.value}
                                                    onChange={(event) => void updateControl(control, event.target.value)}
                                                >
                                                    {control.options.map((option) => (
                                                        <option key={option.value} value={option.value}>{formatModuleControlOption(control, option, labels)}</option>
                                                    ))}
                                                </select>
                                            )}
                                            {control.kind === 'text' && (
                                                <input
                                                    type="text"
                                                    value={control.value}
                                                    onChange={(event) => void updateControl(control, event.target.value)}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </section>

                                <section className="ever-module-management__meta">
                                    <span>{labels.moduleStats(activeModule.lorebook_count, activeModule.regex_count, activeModule.trigger_count)}</span>
                                    <button type="button" disabled={moduleBusy} onClick={() => void onDeleteModule(activeModule.id)}>
                                        <Trash2 aria-hidden="true" size={16} />
                                        {labels.moduleDelete}
                                    </button>
                                </section>
                            </>
                        ) : (
                            <div className="ever-empty-panel">{labels.moduleSelectHint}</div>
                        )}

                        {moduleMessage && (
                            <div className="ever-settings-result">
                                <span>{moduleMessage}</span>
                            </div>
                        )}
                        {moduleError && (
                            <div className="ever-roster__error">
                                <span>{moduleError}</span>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}
