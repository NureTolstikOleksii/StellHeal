import React, { useEffect, useState } from 'react';
import styles from './StatsPage.module.css';
import {
    fetchClinicStats, fetchDoctorStats,
    fetchIntakeStats, fetchAuditLog, fetchAuditActions,
} from '../../services/statsService';
import { useTranslation } from 'react-i18next';
import {
    FaChartBar, FaUserMd, FaUserInjured,
    FaPills, FaExclamationTriangle, FaMicrochip,
    FaShieldAlt, FaChevronLeft, FaChevronRight,
} from 'react-icons/fa';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import LoaderOverlay from '../../components/LoaderOverlay/LoaderOverlay';
import Toast from '../../components/Toast/Toast';
import defaultAvatar from '../../assets/icons/default_avatar.svg';

// ── StatCard ──────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, value, label, color = '#1976d2' }) => (
    <div className={styles.statCard}>
        <div className={styles.statIconWrap} style={{ background: `${color}18`, border: `1px solid ${color}25` }}>
            <Icon size={20} style={{ color }} />
        </div>
        <div className={styles.statValue}>{value ?? '—'}</div>
        <div className={styles.statLabel}>{label}</div>
    </div>
);

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className={styles.tooltip}>
            <p className={styles.tooltipLabel}>{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color, margin: '2px 0', fontSize: 13 }}>
                    {p.name}: <strong>{p.value}</strong>
                </p>
            ))}
        </div>
    );
};

// ── Action badge color ────────────────────────────────────────────────────────
const ACTION_COLORS = {
    LOGIN:           { bg: '#f0fdf4', color: '#16a34a' },
    LOGIN_FAILED:    { bg: '#fef2f2', color: '#ef4444' },
    LOGOUT:          { bg: '#f9fafb', color: '#6b7280' },
    REGISTER:        { bg: '#eff6ff', color: '#1976d2' },
    CREATE_STAFF:    { bg: '#faf5ff', color: '#7c3aed' },
    UPDATE_STAFF:    { bg: '#fff7ed', color: '#d97706' },
    DELETE_STAFF:    { bg: '#fef2f2', color: '#ef4444' },
    SECURITY_EVENT:  { bg: '#fff7ed', color: '#d97706' },
    EXPORT_STAFF:    { bg: '#f0fdf4', color: '#16a34a' },
};

const ActionBadge = ({ action }) => {
    const style = ACTION_COLORS[action] || { bg: '#f3f4f6', color: '#6b7280' };
    return (
        <span className={styles.actionBadge} style={{ background: style.bg, color: style.color }}>
            {action}
        </span>
    );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const StatsPage = () => {
    const { t, i18n } = useTranslation();

    const [clinicStats, setClinicStats]   = useState(null);
    const [doctorStats, setDoctorStats]   = useState([]);
    const [intakeStats, setIntakeStats]   = useState([]);
    const [auditLog, setAuditLog]         = useState({ logs: [], total: 0, pages: 1 });
    const [auditActions, setAuditActions] = useState([]);
    const [auditFilter, setAuditFilter]   = useState('');
    const [auditPage, setAuditPage]       = useState(1);
    const [auditLoading, setAuditLoading] = useState(false);
    const [loading, setLoading]           = useState(true);
    const [toast, setToast] = useState({ open: false, type: 'error', title: '', message: '' });

    const showToast = (type, title, message = '') =>
        setToast({ open: true, type, title, message });

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [clinic, doctors, intake, actions] = await Promise.all([
                    fetchClinicStats(),
                    fetchDoctorStats(),
                    fetchIntakeStats(),
                    fetchAuditActions(),
                ]);
                setClinicStats(clinic.data);
                setDoctorStats(doctors.data);
                setIntakeStats(intake.data);
                setAuditActions(actions.data || []);
            } catch {
                showToast('error', t('stats.load_error') || 'Помилка завантаження');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Завантаження audit log при зміні фільтру або сторінки
    useEffect(() => {
        const loadAudit = async () => {
            setAuditLoading(true);
            try {
                const res = await fetchAuditLog({ page: auditPage, action: auditFilter || null });
                setAuditLog(res.data);
            } catch {
                showToast('error', t('stats.audit_load_error') || 'Помилка завантаження логу');
            } finally {
                setAuditLoading(false);
            }
        };
        loadAudit();
    }, [auditPage, auditFilter]);

    const localizeDay = (day) => {
        const days = {
            uk: { Mon: 'Пн', Tue: 'Вт', Wed: 'Ср', Thu: 'Чт', Fri: 'Пт', Sat: 'Сб', Sun: 'Нд' },
            en: { Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri', Sat: 'Sat', Sun: 'Sun' },
        };
        return days[i18n.language]?.[day] || day;
    };

    const chartData = intakeStats.map(d => ({ ...d, day: localizeDay(d.day) }));

    const formatDateTime = (iso) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleString(
            i18n.language === 'uk' ? 'uk-UA' : 'en-US',
            { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }
        );
    };

    if (loading) return <LoaderOverlay />;

    return (
        <div className={styles.pageWrapper}>

            {/* ── Header ── */}
            <div className={styles.pageHeader}>
                <div className={styles.pageTitleRow}>
                    {/*<FaChartBar className={styles.pageTitleIcon} />*/}
                    <h2 className={styles.pageTitle}>{t('stats.clinic_title')}</h2>
                </div>
            </div>

            {/* ── Stat cards ── */}
            {clinicStats && (
                <div className={styles.statsGrid}>
                    <StatCard icon={FaUserInjured}      value={clinicStats.activePatients}    label={t('stats.active_patients')}    color="#1976d2" />
                    <StatCard icon={FaUserMd}            value={clinicStats.medicalStaff}       label={t('stats.medical_staff')}       color="#7c3aed" />
                    <StatCard icon={FaPills}             value={clinicStats.treatmentPlans}     label={t('stats.treatment_plans')}     color="#16a34a" />
                    <StatCard icon={FaMicrochip}         value={clinicStats.deviceTriggers}     label={t('stats.device_triggers')}     color="#0891b2" />
                    <StatCard icon={FaExclamationTriangle} value={clinicStats.missedAppointments} label={t('stats.missed_appointments')} color="#ef4444" />
                </div>
            )}

            {/* ── Intake chart ── */}
            {chartData.length > 0 && (
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>{t('stats.intake_chart') || 'Прийом ліків за тиждень'}</h3>
                    <p className={styles.sectionSubtitle}>{t('stats.intake_chart_hint') || 'Кількість виконаних та пропущених прийомів по днях'}</p>
                    <div className={styles.chartWrap}>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={chartData} barSize={28} barGap={4}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                <XAxis dataKey="day" tick={{ fontSize: 13, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} width={30} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    wrapperStyle={{ fontSize: 13, paddingTop: 12 }}
                                    formatter={(value) =>
                                        value === 'taken'
                                            ? (t('intake_statuses.taken') || 'Прийнято')
                                            : (t('intake_statuses.missed') || 'Пропущено')
                                    }
                                />
                                <Bar dataKey="taken"  name="taken"  fill="#22c55e" radius={[4,4,0,0]} />
                                <Bar dataKey="missed" name="missed" fill="#ef4444" radius={[4,4,0,0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* ── Doctor stats ── */}
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{t('stats.doctor_stats')}</h3>
                {doctorStats.length === 0 ? (
                    <div className={styles.empty}>{t('stats.no_data') || 'Немає даних'}</div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                            <tr>
                                <th>{t('staff.table.user')}</th>
                                <th>{t('stats.specialization') || 'Спеціалізація'}</th>
                                <th>{t('stats.patients')}</th>
                                <th>{t('stats.active_assignments')}</th>
                                <th>{t('stats.intake_rate') || 'Виконання'}</th>
                            </tr>
                            </thead>
                            <tbody>
                            {doctorStats.map((doc, i) => (
                                <tr key={i}>
                                    <td>
                                        <div className={styles.doctorCell}>
                                            <img src={doc.avatar || defaultAvatar} alt="" className={styles.doctorAvatar} />
                                            <span className={styles.doctorName}>{doc.name}</span>
                                        </div>
                                    </td>
                                    <td className={styles.specCell}>{doc.specialization || '—'}</td>
                                    <td><span className={styles.countBadge}>{doc.patients}</span></td>
                                    <td><span className={styles.activeBadge}>{doc.active}</span></td>
                                    <td>
                                        {doc.intakeRate !== null ? (
                                            <div className={styles.rateWrap}>
                                                <div className={styles.rateBar}>
                                                    <div
                                                        className={styles.rateFill}
                                                        style={{
                                                            width: `${doc.intakeRate}%`,
                                                            background: doc.intakeRate >= 80 ? '#22c55e' : doc.intakeRate >= 50 ? '#f59e0b' : '#ef4444'
                                                        }}
                                                    />
                                                </div>
                                                <span className={styles.rateLabel}>{doc.intakeRate}%</span>
                                            </div>
                                        ) : '—'}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Audit log ── */}
            <div className={styles.section}>
                <div className={styles.auditHeader}>
                    <div className={styles.auditTitleRow}>
                        <FaShieldAlt className={styles.auditIcon} />
                        <h3 className={styles.sectionTitle}>{t('stats.audit_log') || 'Журнал дій'}</h3>
                        <span className={styles.auditTotal}>{auditLog.total}</span>
                    </div>

                    {/* Фільтр по типу дії */}
                    <select
                        className={styles.auditFilter}
                        value={auditFilter}
                        onChange={e => { setAuditFilter(e.target.value); setAuditPage(1); }}
                    >
                        <option value="">{t('stats.audit_all') || 'Всі дії'}</option>
                        {auditActions.map(a => (
                            <option key={a} value={a}>{a}</option>
                        ))}
                    </select>
                </div>

                {auditLoading ? (
                    <div className={styles.auditLoading}>
                        <LoaderOverlay inline />
                    </div>
                ) : auditLog.logs.length === 0 ? (
                    <div className={styles.empty}>{t('stats.no_data') || 'Немає записів'}</div>
                ) : (
                    <>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                <tr>
                                    <th>{t('stats.audit_user') || 'Користувач'}</th>
                                    <th>{t('stats.audit_action') || 'Дія'}</th>
                                    <th>{t('stats.audit_entity') || 'Об\'єкт'}</th>
                                    <th>{t('stats.audit_description') || 'Опис'}</th>
                                    <th>{t('stats.audit_ip') || 'IP'}</th>
                                    <th>{t('stats.audit_time') || 'Час'}</th>
                                </tr>
                                </thead>
                                <tbody>
                                {auditLog.logs.map(log => (
                                    <tr key={log.id}>
                                        <td>
                                            {log.user ? (
                                                <div className={styles.doctorCell}>
                                                    <img src={log.user.avatar || defaultAvatar} alt="" className={styles.auditAvatar} />
                                                    <div>
                                                        <div className={styles.auditUserName}>{log.user.name}</div>
                                                        <div className={styles.auditUserRole}>{log.user.role}</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className={styles.auditSystem}>system</span>
                                            )}
                                        </td>
                                        <td><ActionBadge action={log.action} /></td>
                                        <td>
                                            <span className={styles.auditEntity}>{log.entity}</span>
                                            {log.entity_id && <span className={styles.auditEntityId}> #{log.entity_id}</span>}
                                        </td>
                                        <td className={styles.auditDesc}>{log.description || '—'}</td>
                                        <td className={styles.auditIp}>{log.ip_address || '—'}</td>
                                        <td className={styles.auditTime}>{formatDateTime(log.created_at)}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Пагінація */}
                        {auditLog.pages > 1 && (
                            <div className={styles.pagination}>
                                <button
                                    className={styles.pageBtn}
                                    onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                                    disabled={auditPage === 1}
                                >
                                    <FaChevronLeft size={10} />
                                </button>
                                <span className={styles.pageInfo}>
                                    {auditPage} / {auditLog.pages}
                                </span>
                                <button
                                    className={styles.pageBtn}
                                    onClick={() => setAuditPage(p => Math.min(auditLog.pages, p + 1))}
                                    disabled={auditPage === auditLog.pages}
                                >
                                    <FaChevronRight size={10} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <Toast
                open={toast.open}
                type={toast.type}
                title={toast.title}
                message={toast.message}
                onClose={() => setToast(p => ({ ...p, open: false }))}
            />
        </div>
    );
};

export default StatsPage;