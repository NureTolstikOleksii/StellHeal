export function formatTime(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    });
}

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

export function formatDate(isoString, lang = 'uk') {
    if (!isoString) return '—';
    const locale = lang === 'uk' ? 'uk-UA' : 'en-US';
    return new Date(isoString).toLocaleDateString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

export function formatDateLong(isoString, lang = 'uk') {
    if (!isoString) return '—';
    const locale = lang === 'uk' ? 'uk-UA' : 'en-US';
    return new Date(isoString).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

export function formatTimeForInput(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}