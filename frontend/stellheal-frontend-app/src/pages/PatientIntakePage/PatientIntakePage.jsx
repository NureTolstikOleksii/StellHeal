import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
    FaCheckCircle, FaTimesCircle, FaClock,
    FaChevronLeft, FaChevronRight, FaPills,
} from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import styles from './PatientIntakePage.module.css';
import { getPatientById, getIntakeStats } from '../../services/patientService';
import LoaderOverlay from "../../components/LoaderOverlay/LoaderOverlay.jsx";
import { formatDateLong, formatTime } from '../../utils/dateTime';
import i18n from "i18next";


const addDays = (iso, n) => {
    const d = new Date(iso);
    d.setDate(d.getDate() + n);
    return d.toISOString().substring(0, 10);
};

const today = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
}).format(new Date());

const WeekStrip = ({ selected, onChange, startDate, endDate }) => {
    const { t } = useTranslation();
    const [weekStart, setWeekStart] = useState(() => {
        const d = new Date(startDate);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return d.toISOString().substring(0, 10);
    });

    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const DAY_NAMES = [
        t('week.mon'), t('week.tue'), t('week.wed'),
        t('week.thu'), t('week.fri'), t('week.sat'), t('week.sun')
    ];

    const canGoPrev = addDays(weekStart, -1) >= startDate;
    const canGoNext = addDays(weekStart, 7)  <= endDate;

    return (
        <div className={styles.weekStrip}>
            <button className={styles.weekNav} onClick={() => setWeekStart(addDays(weekStart, -7))} disabled={!canGoPrev}>
                <FaChevronLeft size={13} />
            </button>
            <div className={styles.weekDays}>
                {days.map((day, i) => {
                    const isToday    = day === today();
                    const isSelected = day === selected;
                    const inRange    = day >= startDate && day <= endDate;
                    return (
                        <button
                            key={day}
                            className={`${styles.dayBtn} ${isSelected ? styles.dayBtnActive : ''} ${isToday ? styles.dayBtnToday : ''} ${!inRange ? styles.dayBtnDisabled : ''}`}
                            onClick={() => inRange && onChange(day)}
                            disabled={!inRange}
                        >
                            <span className={styles.dayName}>{DAY_NAMES[i]}</span>
                            <span className={styles.dayNum}>{new Date(day).getDate()}</span>
                        </button>
                    );
                })}
            </div>
            <button className={styles.weekNav} onClick={() => setWeekStart(addDays(weekStart, 7))} disabled={!canGoNext}>
                <FaChevronRight size={13} />
            </button>
        </div>
    );
};

const RingChart = ({ taken, total }) => {
    const pct  = total > 0 ? taken / total : 0;
    const r    = 54;
    const circ = 2 * Math.PI * r;
    const dash = circ * pct;

    return (
        <div className={styles.ring}>
            <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r={r} fill="none" stroke="#e5e7eb" strokeWidth="12" />
                <circle cx="70" cy="70" r={r} fill="none"
                        stroke={pct >= 0.8 ? '#22c55e' : pct >= 0.5 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="12" strokeLinecap="round"
                        strokeDasharray={`${dash} ${circ}`}
                        strokeDashoffset={circ * 0.25}
                        style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
            </svg>
            <div className={styles.ringInner}>
                <FaPills className={styles.ringIcon} />
                <span className={styles.ringFraction}>{taken}<span className={styles.ringTotal}>/{total}</span></span>
            </div>
        </div>
    );
};

const IntakeRow = ({ item }) => {
    const { t } = useTranslation();

    const STATUS = {
        taken:   { label: t('intake_statuses.taken'),   Icon: FaCheckCircle, cls: 'taken'   },
        missed:  { label: t('intake_statuses.missed'),  Icon: FaTimesCircle, cls: 'missed'  },
        pending: { label: t('intake_statuses.pending'), Icon: FaClock,       cls: 'pending' },
    };

    const { label, Icon, cls } = STATUS[item.status] || STATUS.pending;

    return (
        <div className={`${styles.intakeRow} ${styles[`row_${cls}`]}`}>
            {/* ← конвертуємо UTC ISO в локальний час браузера */}
            <div className={styles.intakeTime}>
                {item.intake_at ? formatTime(item.intake_at) : '—'}
            </div>
            <div className={styles.intakeDot} />
            <div className={styles.intakeInfo}>
                <span className={styles.intakeName}>{item.name}</span>
                <span className={styles.intakeDiagnosis}>{item.diagnosis}</span>
            </div>
            <div className={styles.intakeQty}>{item.quantity} {t('patient_intake.unit')}</div>
            <div className={`${styles.intakeBadge} ${styles[`badge_${cls}`]}`}>
                <Icon size={12} />
                <span>{label}</span>
            </div>
        </div>
    );
};

const PatientIntakePage = () => {
    const { id, prescriptionId } = useParams();
    const navigate  = useNavigate();
    const location  = useLocation();
    const { t }     = useTranslation();

    const startDate = location.state?.startDate || today();
    const endDate   = location.state?.endDate   || today();

    const [patient, setPatient] = useState(null);
    const [date, setDate]       = useState(() => {
        const tToday = today();
        return (tToday >= startDate && tToday <= endDate) ? tToday : startDate;
    });
    const [stats, setStats]     = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getPatientById(id).then(setPatient).catch(console.error);
    }, [id]);

    useEffect(() => {
        setLoading(true);
        getIntakeStats(id, date, prescriptionId)
            .then(setStats)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id, date, prescriptionId]);

    const calcAge = (dob) => dob ? String(new Date().getFullYear() - new Date(dob).getFullYear()) : '?';
    const pct = stats ? Math.round((stats.summary.taken / (stats.summary.total || 1)) * 100) : 0;

    if (!patient) return <LoaderOverlay />;

    return (
        <div className={styles.page}>

            <div className={styles.header}>
                <div>
                    <div className={styles.breadcrumb}>
                        <span className={styles.breadLink} onClick={() => navigate('/main/patients')}>
                            {t('patient_intake.breadcrumb_patients')}
                        </span>
                        <span className={styles.breadSep}>/</span>
                        <span className={styles.breadLink} onClick={() => navigate(`/main/patients/${id}`)}>
                            {patient?.name}
                        </span>
                        <span className={styles.breadSep}>/</span>
                        <span>{t('patient_intake.breadcrumb_current')}</span>
                    </div>
                    <div className={styles.titleRow}>
                        <h2 className={styles.title}>{t('patient_intake.title')}</h2>
                    </div>
                </div>
                {patient && (
                    <div className={styles.patientBadge}>
                        <img src={patient.avatar || '/default_avatar.svg'} alt="" className={styles.avatar} />
                        <div>
                            <div className={styles.patientName}>{patient.name}</div>
                            <div className={styles.patientMeta}>
                                {calcAge(patient.dob)} {t('patient_intake.years_short')} · {patient.phone}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <WeekStrip selected={date} onChange={setDate} startDate={startDate} endDate={endDate} />

            {loading ? (
                <LoaderOverlay inline />
            ) : stats && (
                <>
                    <div className={styles.summaryRow}>
                        <div className={styles.ringCard}>
                            <RingChart taken={stats.summary.taken} total={stats.summary.total} />
                            <div className={styles.ringLabel}>
                                <span className={styles.ringPct} style={{ color: pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444' }}>
                                    {pct}%
                                </span>
                                <span className={styles.ringDesc}>{t('patient_intake.daily_performance')}</span>
                            </div>
                        </div>
                        <div className={styles.statsGrid}>
                            <div className={`${styles.statCard} ${styles.statTaken}`}>
                                <FaCheckCircle className={styles.statIcon} />
                                <span className={styles.statNum}>{stats.summary.taken}</span>
                                <span className={styles.statLabel}>{t('intake_statuses.taken')}</span>
                            </div>
                            <div className={`${styles.statCard} ${styles.statMissed}`}>
                                <FaTimesCircle className={styles.statIcon} />
                                <span className={styles.statNum}>{stats.summary.missed}</span>
                                <span className={styles.statLabel}>{t('intake_statuses.missed')}</span>
                            </div>
                            <div className={`${styles.statCard} ${styles.statPending}`}>
                                <FaClock className={styles.statIcon} />
                                <span className={styles.statNum}>{stats.summary.pending}</span>
                                <span className={styles.statLabel}>{t('intake_statuses.pending')}</span>
                            </div>
                            <div className={`${styles.statCard} ${styles.statTotal}`}>
                                <FaPills className={styles.statIcon} />
                                <span className={styles.statNum}>{stats.summary.total}</span>
                                <span className={styles.statLabel}>{t('patient_intake.total')}</span>
                            </div>
                        </div>
                    </div>

                    <div className={styles.scheduleCard}>
                        <div className={styles.scheduleTitle}>
                            <FaClock size={14} />
                            <span>{t('patient_intake.schedule_for')} {formatDateLong(date, i18n.language)}</span>
                        </div>
                        {stats.schedule.length === 0 ? (
                            <div className={styles.empty}>
                                <FaPills size={32} className={styles.emptyIcon} />
                                <p>{t('patient_intake.no_prescriptions')}</p>
                            </div>
                        ) : (
                            <div className={styles.timeline}>
                                {stats.schedule.map(item => (
                                    <IntakeRow key={item.id} item={item} />
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default PatientIntakePage;