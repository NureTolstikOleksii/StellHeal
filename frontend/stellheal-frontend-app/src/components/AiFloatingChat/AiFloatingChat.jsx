import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import styles from './AiFloatingChat.module.css';
import { useTranslation } from 'react-i18next';
import {
    FaComments,
    FaRegComments,
    FaTimes,
    FaPaperPlane,
    FaSpinner,
    FaTrash,
    FaCheckCircle,
    FaPills,
    FaExclamationTriangle,
    FaStethoscope,
    FaMicroscope
} from 'react-icons/fa';
import { streamAiRecommendation } from '../../services/patientService';

const QUICK_QUESTIONS = [
    { id: 'interact', translationKey: 'ai_chat.questions.interact', text: 'Чи є взаємодії між призначеними препаратами?' },
    { id: 'contra',   translationKey: 'ai_chat.questions.contra',   text: 'Які протипоказання у цих препаратів?' },
    { id: 'alt',      translationKey: 'ai_chat.questions.alt',      text: 'Запропонуй альтернативне лікування для цього діагнозу' },
    { id: 'tests',    translationKey: 'ai_chat.questions.tests',    text: 'Які додаткові аналізи варто призначити?' },
];

const renderQuickIcon = (id) => {
    switch (id) {
        case 'interact': return <FaPills size={12} style={{ marginRight: '5px' }} />;
        case 'contra':   return <FaExclamationTriangle size={11} style={{ marginRight: '5px' }} />;
        case 'alt':      return <FaStethoscope size={12} style={{ marginRight: '5px' }} />;
        case 'tests':    return <FaMicroscope size={12} style={{ marginRight: '5px' }} />;
        default:         return null;
    }
};

const AiFloatingChat = forwardRef(({ context }, ref) => {
    const { t } = useTranslation();
    const [open, setOpen]         = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput]       = useState('');
    const [loading, setLoading]   = useState(false);
    const [unread, setUnread]     = useState(0);
    const abortRef  = useRef(null);
    const bottomRef = useRef(null);
    const inputRef  = useRef(null);

    useEffect(() => {
        if (open) { setUnread(0); setTimeout(() => inputRef.current?.focus(), 100); }
    }, [open]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    useImperativeHandle(ref, () => ({
        openWithSuggestion: (label, suggestionText, onApply) => {
            setOpen(true);
            setUnread(0);
            setMessages(prev => [
                ...prev,
                { role: 'system-label', text: label, isHintLabel: true },
                { role: 'assistant', text: suggestionText, onApply, applyLabel: label }
            ]);
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        },
        updateLastMessage: (text) => {
            setMessages(prev => {
                const u = [...prev];
                const last = u[u.length - 1];
                if (last?.role === 'assistant') {
                    u[u.length - 1] = { ...last, text };
                }
                return u;
            });
        },
    }));

    const buildHistory = () =>
        messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => `${m.role === 'user' ? 'Лікар' : 'AI'}: ${m.text}`)
            .join('\n');

    const send = async (text) => {
        const msg = (text || input).trim();
        if (!msg || loading) return;
        setInput('');

        setMessages(prev => [...prev,
            { role: 'user', text: msg },
            { role: 'assistant', text: '', streaming: true }
        ]);
        setLoading(true);

        abortRef.current?.abort();
        abortRef.current = new AbortController();

        let acc = '';
        try {
            await streamAiRecommendation(
                'chat',
                { context, previousAnswer: '', question: msg, historyContext: buildHistory() },
                chunk => {
                    acc += chunk;
                    setMessages(prev => {
                        const u = [...prev];
                        u[u.length - 1] = { role: 'assistant', text: acc, streaming: false };
                        return u;
                    });
                },
                abortRef.current.signal
            );
        } catch (e) {
            if (e.name !== 'AbortError') {
                setMessages(prev => {
                    const u = [...prev];
                    u[u.length - 1] = { role: 'assistant', text: t('ai_chat.error_connection'), streaming: false };
                    return u;
                });
            }
        } finally {
            setLoading(false);
            if (!open) setUnread(p => p + 1);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    };

    const clearChat = () => setMessages([]);

    return (
        <>
            <button
                className={`${styles.fab} ${open ? styles.fabOpen : ''}`}
                onClick={() => setOpen(p => !p)}
                title={t('ai_chat.fab_title')}
            >
                {open ? <FaTimes size={20} /> : <FaComments size={24} />}
                {!open && unread > 0 && <span className={styles.badge}>{unread}</span>}
            </button>

            <div className={`${styles.chatWindow} ${open ? styles.chatWindowOpen : ''}`}>

                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div className={styles.headerAvatar}><FaComments size={16} /></div>
                        <div>
                            <div className={styles.headerTitle}>{t('ai_chat.assistant_title')}</div>
                            <div className={styles.headerSub}>
                                {loading ? t('ai_chat.assistant_sub_typing') : t('ai_chat.assistant_sub_default')}
                            </div>
                        </div>
                    </div>
                    <div className={styles.headerActions}>
                        {messages.length > 0 && (
                            <button className={styles.iconBtn} onClick={clearChat} title={t('ai_chat.clear_chat')}>
                                <FaTrash size={12} />
                            </button>
                        )}
                        <button className={styles.iconBtn} onClick={() => setOpen(false)} title={t('ai_chat.close_chat')}>
                            <FaTimes size={14} />
                        </button>
                    </div>
                </div>

                <div className={styles.messages}>
                    {messages.length === 0 ? (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>
                                <FaRegComments size={40} color="#cbd5e1" />
                            </div>
                            <p>{t('ai_chat.empty_state')}</p>
                        </div>
                    ) : (
                        messages.map((msg, i) => {

                            if (msg.role === 'system-label') {
                                return (
                                    <div key={i} className={styles.systemLabel}>
                                        <span>
                                            {msg.isHintLabel ? t('ai_chat.hint_prefix') : ''}{msg.text}
                                        </span>
                                    </div>
                                );
                            }

                            if (msg.role === 'user') {
                                return (
                                    <div key={i} className={`${styles.msg} ${styles.msgUser}`}>
                                        <div className={styles.msgBubble}>{msg.text}</div>
                                    </div>
                                );
                            }

                            return (
                                <div key={i} className={`${styles.msg} ${styles.msgAi}`}>
                                    <div className={styles.msgAvatar}><FaRegComments size={12} /></div>
                                    <div className={styles.msgContent}>
                                        <div className={styles.msgBubble}>
                                            {msg.text || (loading && i === messages.length - 1
                                                    ? <span className={styles.typing}><span/><span/><span/></span>
                                                    : null
                                            )}
                                        </div>
                                        {msg.onApply && msg.text && (
                                            <button
                                                className={styles.applyBtn}
                                                onClick={() => { msg.onApply(msg.text); }}
                                            >
                                                <FaCheckCircle size={11} />
                                                {t('ai_chat.apply_to_field', { label: msg.applyLabel })}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={bottomRef} />
                </div>

                <div className={styles.quick}>
                    {QUICK_QUESTIONS.map((q, i) => (
                        <button
                            key={i}
                            className={styles.quickBtn}
                            onClick={() => send(q.text)}
                            disabled={loading}
                            style={{ display: 'inline-flex', alignItems: 'center' }}
                        >
                            {renderQuickIcon(q.id)}
                            {t(q.translationKey)}
                        </button>
                    ))}
                </div>

                <div className={styles.inputWrap}>
                    <textarea
                        ref={inputRef}
                        className={styles.input}
                        placeholder={t('ai_chat.placeholder')}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={2}
                        disabled={loading}
                    />
                    <button
                        className={styles.sendBtn}
                        onClick={() => send()}
                        disabled={!input.trim() || loading}
                    >
                        {loading
                            ? <FaSpinner className={styles.spinner} size={15} />
                            : <FaPaperPlane size={15} />
                        }
                    </button>
                </div>
            </div>
        </>
    );
});

AiFloatingChat.displayName = 'AiFloatingChat';
export default AiFloatingChat;