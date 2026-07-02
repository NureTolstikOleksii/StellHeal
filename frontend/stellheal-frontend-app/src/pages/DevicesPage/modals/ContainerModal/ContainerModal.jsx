import React, { useEffect, useState } from 'react';
import styles from './ContainerModal.module.css';
import {
    FaTimes, FaUser, FaCircle, FaCheckCircle,
    FaClock, FaCalendarAlt, FaExclamationTriangle,
    FaInfoCircle, FaBolt, FaFlask, FaHourglass,
} from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { fetchAdminCompartments, fetchContainerEvents, fetchContainerSessions } from '../../../../services/containerService.js';
import LoaderOverlay from '../../../../components/LoaderOverlay/LoaderOverlay.jsx';
import { formatDateTime, formatTime } from '../../../../utils/dateTime';


const Drum = ({ compartments, selected, onSelect }) => {
    const total  = 8;
    const cx     = 160;
    const cy     = 160;
    const rOuter = 130;
    const rInner = 58;
    const rText  = 97;

    const sectors = Array.from({ length: total }, (_, i) => {
        const comp = compartments[i];
        const rad  = (a) => (a * Math.PI) / 180;

        const angle      = (360 / total) * i - 90;
        const startAngle = rad(angle);
        const endAngle   = rad(angle + 360 / total - 1);

        const x1 = cx + rOuter * Math.cos(startAngle);
        const y1 = cy + rOuter * Math.sin(startAngle);
        const x2 = cx + rOuter * Math.cos(endAngle);
        const y2 = cy + rOuter * Math.sin(endAngle);
        const x3 = cx + rInner * Math.cos(endAngle);
        const y3 = cy + rInner * Math.sin(endAngle);
        const x4 = cx + rInner * Math.cos(startAngle);
        const y4 = cy + rInner * Math.sin(startAngle);

        const midAngle = rad(angle + 360 / total / 2);
        const textX    = cx + rText * Math.cos(midAngle);
        const textY    = cy + rText * Math.sin(midAngle);

        const isFilled   = comp?.is_filled;
        const isSelected = selected === i;

        const fill   = isSelected ? '#1976d2' : isFilled ? '#22c55e' : '#f3f4f6';
        const stroke = isSelected ? '#1565c0' : '#fff';

        const intakeAt  = comp?.compartment_medications?.[0]
            ?.prescription_medications?.intake_at;
        const timeLabel = intakeAt ? formatTime(intakeAt) : null;

        return (
            <g key={i} onClick={() => onSelect(i)} style={{ cursor: 'pointer' }}>
                <path
                    d={`M ${x1} ${y1} A ${rOuter} ${rOuter} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 0 0 ${x4} ${y4} Z`}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth="3"
                    style={{ transition: 'fill 0.2s' }}
                />
                <text
                    x={textX}
                    y={timeLabel ? textY - 7 : textY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="15"
                    fontWeight="700"
                    fill={isSelected || isFilled ? '#fff' : '#6b7280'}
                >
                    {i + 1}
                </text>
                {timeLabel && (
                    <text
                        x={textX}
                        y={textY + 8}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="9"
                        fill={isSelected || isFilled ? 'rgba(255,255,255,0.85)' : '#9ca3af'}
                    >
                        {timeLabel}
                    </text>
                )}
            </g>
        );
    });

    return (
        <svg viewBox="0 0 320 320" className={styles.drumSvg}>
            <circle cx={cx} cy={cy} r={rOuter + 6} fill="#f0f4ff" />
            {sectors}
            <circle cx={cx} cy={cy} r={rInner - 3} fill="#fff" stroke="#e5e7eb" strokeWidth="2" />
            <text x={cx} y={cy - 9} textAnchor="middle" fontSize="11" fill="#9ca3af" fontWeight="700">8</text>
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fill="#9ca3af">прийомів</text>
            <text x={cx} y={cy + 16} textAnchor="middle" fontSize="9" fill="#9ca3af">на день</text>
        </svg>
    );
};

const EventIcon = ({ type }) => {
    if (type === 'error')   return <FaExclamationTriangle size={13} className={styles.eventIconError} />;
    if (type === 'warning') return <FaExclamationTriangle size={13} className={styles.eventIconWarn} />;
    if (type === 'trigger') return <FaBolt size={13} className={styles.eventIconTrigger} />;
    return <FaInfoCircle size={13} className={styles.eventIconInfo} />;
};

const relativeTime = (dateStr, lang) => {
    if (!dateStr) return '—';
    const diff  = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);

    if (lang === 'uk') {
        if (mins  < 1)  return 'щойно';
        if (mins  < 60) return `${mins} хв тому`;
        if (hours < 24) return `${hours} год тому`;
        return `${days} д тому`;
    } else {
        if (mins  < 1)  return 'just now';
        if (mins  < 60) return `${mins}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    }
};

const ContainerModal = ({ container, onClose }) => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language || 'uk';

    const [compartments, setCompartments] = useState([]);
    const [events, setEvents]             = useState([]);
    const [sessions, setSessions]         = useState([]);
    const [loading, setLoading]           = useState(true);
    const [selected, setSelected]         = useState(null);

    useEffect(() => {
        Promise.all([
            fetchAdminCompartments(container.container_id),
            fetchContainerEvents(container.container_id),
            fetchContainerSessions(container.container_id),
        ])
            .then(([compRes, eventsRes, sessionsRes]) => {
                setCompartments(compRes.data || []);
                setEvents(eventsRes.data || []);
                setSessions(sessionsRes.data || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [container.container_id]);

    const selectedComp = selected !== null ? compartments[selected] : null;

    const filledCount = compartments.filter(c => c?.is_filled).length;
    const emptyCount  = 8 - filledCount;

    const lastFillDate = compartments
        .flatMap(c => c?.compartment_medications || [])
        .map(m => m.fill_time)
        .filter(Boolean)
        .sort()
        .at(-1);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>

                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <h3 className={styles.title}>
                            Контейнер <span className={styles.number}>#{container.container_number}</span>
                        </h3>
                        <span className={`${styles.statusBadge} ${container.is_online ? styles.online : styles.offline}`}>
                            <FaCircle size={7} />
                            {container.is_online ? t('devices.online') : t('devices.offline')}
                        </span>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <FaTimes size={15} />
                    </button>
                </div>

                <div className={styles.infoRow}>
                    {container.users && (
                        <div className={styles.infoItem}>
                            <FaUser size={12} className={styles.infoIcon} />
                            <span>{container.users.last_name} {container.users.first_name}</span>
                        </div>
                    )}
                    {lastFillDate && (
                        <div className={styles.infoItem}>
                            <FaCalendarAlt size={12} className={styles.infoIcon} />
                            <span>Заповнено: {formatDateTime(lastFillDate, lang)}</span>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className={styles.loaderWrap}><LoaderOverlay inline /></div>
                ) : (
                    <>
                        <div className={styles.content}>
                            <div className={styles.drumWrap}>
                                <Drum
                                    compartments={compartments}
                                    selected={selected}
                                    onSelect={i => setSelected(prev => prev === i ? null : i)}
                                />
                                <div className={styles.progress}>
                                    <div className={styles.progressBar}>
                                        <div
                                            className={styles.progressFill}
                                            style={{ width: `${(filledCount / 8) * 100}%` }}
                                        />
                                    </div>
                                    <span className={styles.progressLabel}>
                                        {filledCount}/8 заповнено на сьогодні
                                    </span>
                                </div>
                                <div className={styles.legend}>
                                    <div className={styles.legendItem}>
                                        <span className={styles.legendDot} style={{ background: '#22c55e' }} />
                                        <span>Заповнено ({filledCount})</span>
                                    </div>
                                    <div className={styles.legendItem}>
                                        <span className={styles.legendDot} style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }} />
                                        <span>Порожній ({emptyCount})</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.detail}>
                                {selected === null ? (
                                    <div className={styles.detailHint}>
                                        <div className={styles.hintIcon}>💊</div>
                                        <p>Натисніть на відсік щоб побачити який препарат призначено на цей прийом</p>
                                    </div>
                                ) : (
                                    <div className={styles.detailCard}>
                                        <div className={styles.detailHeader}>
                                            <span className={styles.detailTitle}>Відсік #{selected + 1}</span>
                                            {selectedComp?.is_filled ? (
                                                <span className={styles.filledBadge}>
                                                    <FaCheckCircle size={11} /> Заповнено
                                                </span>
                                            ) : (
                                                <span className={styles.emptyBadge}>
                                                    <FaClock size={11} /> Порожній
                                                </span>
                                            )}
                                        </div>

                                        {selectedComp?.compartment_medications?.[0]
                                            ?.prescription_medications?.intake_at && (
                                            <div className={styles.intakeTime}>
                                                <FaClock size={12} />
                                                Час прийому:{' '}
                                                <strong>
                                                    {formatTime(
                                                        selectedComp.compartment_medications[0]
                                                            .prescription_medications.intake_at
                                                    )}
                                                </strong>
                                            </div>
                                        )}

                                        {selectedComp?.compartment_medications?.length > 0 ? (
                                            <div className={styles.medList}>
                                                {selectedComp.compartment_medications.map((med, idx) => (
                                                    <div key={idx} className={styles.medItem}>
                                                        <div className={styles.medName}>
                                                            {med.prescription_medications?.medication_name || '—'}
                                                        </div>
                                                        <div className={styles.medMeta}>
                                                            {med.prescription_medications?.quantity && (
                                                                <span className={styles.medQty}>
                                                                    {med.prescription_medications.quantity} од.
                                                                </span>
                                                            )}
                                                            {med.fill_time && (
                                                                <span>Засипано: {formatDateTime(med.fill_time, lang)}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className={styles.noMeds}>
                                                Препарат ще не призначено або не засипано
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles.eventsSection}>
                            <div className={styles.eventsTitleRow}>
                                <FaFlask className={styles.eventsIcon} />
                                <h4 className={styles.eventsTitle}>
                                    {t('devices.sessions_title') || 'Сесії заповнення'}
                                </h4>
                                {sessions.length > 0 && (
                                    <span className={styles.eventsCount}>{sessions.length}</span>
                                )}
                            </div>

                            {sessions.length === 0 ? (
                                <div className={styles.eventsEmpty}>
                                    {t('devices.sessions_empty') || 'Сесій заповнення ще не було'}
                                </div>
                            ) : (
                                <div className={styles.sessionsList}>
                                    {sessions.map(s => {
                                        const duration = s.finished_at
                                            ? Math.round((new Date(s.finished_at) - new Date(s.started_at)) / 1000)
                                            : null;
                                        const durationStr = duration !== null
                                            ? duration < 60
                                                ? `${duration} с`
                                                : `${Math.floor(duration / 60)} хв ${duration % 60} с`
                                            : null;

                                        return (
                                            <div key={s.session_id} className={styles.sessionItem}>
                                                <div className={styles.sessionIcon}>
                                                    <FaFlask size={13} />
                                                </div>
                                                <div className={styles.sessionInfo}>
                                                    <div className={styles.sessionUser}>
                                                        {s.users
                                                            ? `${s.users.last_name} ${s.users.first_name}`
                                                            : '—'
                                                        }
                                                    </div>
                                                    <div className={styles.sessionMeta}>
                                                        {formatDateTime(s.started_at, lang)}
                                                        {durationStr && (
                                                            <span className={styles.sessionDuration}>
                                                                <FaHourglass size={10} /> {durationStr}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className={`${styles.sessionStatus} ${s.status === 'completed' ? styles.sessionDone : styles.sessionActive}`}>
                                                    {s.status === 'completed'
                                                        ? (t('devices.session_done') || 'Завершено')
                                                        : (t('devices.session_active') || 'В процесі')
                                                    }
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className={styles.eventsSection}>
                            <div className={styles.eventsTitleRow}>
                                <FaBolt className={styles.eventsIcon} />
                                <h4 className={styles.eventsTitle}>
                                    {t('devices.events_title') || 'Події пристрою'}
                                </h4>
                                {events.length > 0 && (
                                    <span className={styles.eventsCount}>{events.length}</span>
                                )}
                            </div>

                            {events.length === 0 ? (
                                <div className={styles.eventsEmpty}>
                                    {t('devices.events_empty') || 'Подій ще не зафіксовано'}
                                </div>
                            ) : (
                                <div className={styles.eventsList}>
                                    {events.map(ev => (
                                        <div
                                            key={ev.id}
                                            className={`${styles.eventItem} ${styles[`event_${ev.type}`] || ''}`}
                                        >
                                            <div className={styles.eventIconWrap}>
                                                <EventIcon type={ev.type} />
                                            </div>
                                            <div className={styles.eventInfo}>
                                                <div className={styles.eventTop}>
                                                    <span className={`${styles.eventType} ${styles[`eventType_${ev.type}`]}`}>
                                                        {ev.type?.toUpperCase()}
                                                    </span>
                                                    {ev.code && (
                                                        <span className={styles.eventCode}>{ev.code}</span>
                                                    )}
                                                </div>
                                                {ev.message && (
                                                    <div className={styles.eventMessage}>{ev.message}</div>
                                                )}
                                            </div>
                                            <div className={styles.eventTime}>
                                                {relativeTime(ev.created_at, lang)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ContainerModal;