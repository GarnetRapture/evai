const EDITABLE_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);
const BLOCKED_DOCUMENT_EVENTS = ['contextmenu', 'dragstart', 'drop'] as const;
const BLOCKED_OUTSIDE_EDITABLE_EVENTS = ['copy', 'cut', 'selectstart'] as const;

export function isEditableInteractionTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    if (target instanceof HTMLTextAreaElement) {
        return !target.disabled && !target.readOnly;
    }
    if (target instanceof HTMLInputElement) {
        return EDITABLE_INPUT_TYPES.has(target.type) && !target.disabled && !target.readOnly;
    }
    return target.isContentEditable;
}

function preventEvent(event: Event): void {
    event.preventDefault();
}

function preventOutsideEditable(event: Event): void {
    if (!isEditableInteractionTarget(event.target)) {
        event.preventDefault();
    }
}

export function installFocusInteractionGuard(root: Document): () => void {
    for (const type of BLOCKED_DOCUMENT_EVENTS) {
        root.addEventListener(type, preventEvent, true);
    }
    for (const type of BLOCKED_OUTSIDE_EDITABLE_EVENTS) {
        root.addEventListener(type, preventOutsideEditable, true);
    }
    return () => {
        for (const type of BLOCKED_DOCUMENT_EVENTS) {
            root.removeEventListener(type, preventEvent, true);
        }
        for (const type of BLOCKED_OUTSIDE_EDITABLE_EVENTS) {
            root.removeEventListener(type, preventOutsideEditable, true);
        }
    };
}
