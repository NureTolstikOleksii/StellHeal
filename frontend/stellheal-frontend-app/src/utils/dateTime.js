// ─── UTC ISO → локальний час "HH:mm" ─────────────────────────────────────────
export function formatTime(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    });
}
// ─── UTC ISO → локальна дата та час "dd.mm.yyyy, HH:mm" (з урахуванням мови) ───
export function formatDateTime(isoString, lang = 'uk') {
    if (!isoString) return '—';
    const locale = lang === 'uk' ? 'uk-UA' : 'en-US';
    return new Date(isoString).toLocaleString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// ─── UTC ISO → локальна дата та час ДОВГА "1 червня 2026, HH:mm" ──────────────
export function formatDateTimeLong(isoString, lang = 'uk') {
    if (!isoString) return '—';
    const locale = lang === 'uk' ? 'uk-UA' : 'en-US';
    return new Date(isoString).toLocaleString(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// ─── UTC ISO → локальна дата "dd.mm.yyyy" (з урахуванням мови) ───────────────
export function formatDate(isoString, lang = 'uk') {
    if (!isoString) return '—';
    const locale = lang === 'uk' ? 'uk-UA' : 'en-US';
    return new Date(isoString).toLocaleDateString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

// ─── UTC ISO → локальна дата довга "1 червня 2026" (з урахуванням мови) ──────
export function formatDateLong(isoString, lang = 'uk') {
    if (!isoString) return '—';
    const locale = lang === 'uk' ? 'uk-UA' : 'en-US';
    return new Date(isoString).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

// ─── UTC ISO → "HH:mm" для input type="time" ─────────────────────────────────
export function formatTimeForInput(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}