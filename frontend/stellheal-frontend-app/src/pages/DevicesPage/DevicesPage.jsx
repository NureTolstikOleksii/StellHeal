import React, { useEffect, useState } from 'react';
import styles from './DevicesPage.module.css';
import {
    fetchContainerStats,
    fetchLatestFillings,
    fetchTotalContainers,
    fetchAllContainers,
    exportContainers,
    registerContainer,
    deleteContainer,
} from '../../services/containerService';
import {
    FaFileExport, FaPlus, FaCircle,
    FaUser, FaMicrochip, FaTimes,
    FaCheckCircle, FaTrashAlt,
} from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import LoaderOverlay from '../../components/LoaderOverlay/LoaderOverlay';
import Toast from '../../components/Toast/Toast';
import ContainerModal from './modals/ContainerModal/ContainerModal.jsx';
import { formatDateTime, formatTime } from '../../utils/dateTime';


const RegisterModal = ({ onClose, onSuccess }) => {
    const { t } = useTranslation();
    const [deviceUid, setDeviceUid] = useState('');
    const [error, setError]         = useState('');
    const [saving, setSaving]       = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!deviceUid.trim()) { setError(t('profile.required')); return; }
        setSaving(true);
        try {
            await registerContainer({ device_uid: deviceUid.trim() });
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || t('devices.register_error'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <div className={styles.modalTitleRow}>
                        <FaMicrochip className={styles.modalTitleIcon} />
                        <h3 className={styles.modalTitle}>{t('devices.register_title')}</h3>
                    </div>
                    <button className={styles.modalCloseBtn} onClick={onClose}>
                        <FaTimes size={15} />
                    </button>
                </div>

                <p className={styles.modalSubtitle}>{t('devices.register_hint')}</p>

                <form onSubmit={handleSubmit} noValidate className={styles.modalForm}>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>{t('devices.device_uid')}</label>
                        <input
                            type="text"
                            className={`${styles.input} ${error ? styles.inputError : ''}`}
                            placeholder="e.g. STH-0001-XXXX"
                            value={deviceUid}
                            onChange={e => { setDeviceUid(e.target.value); setError(''); }}
                            autoFocus
                        />
                        {error && <span className={styles.fieldError}>{error}</span>}
                    </div>

                    <div className={styles.modalActions}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>
                            {t('common.cancel')}
                        </button>
                        <button type="submit" className={styles.submitBtn} disabled={saving}>
                            {saving ? '...' : t('devices.register')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const StatusBadge = ({ isOnline }) => {
    const { t } = useTranslation();
    return (
        <span className={`${styles.badge} ${isOnline ? styles.badgeOnline : styles.badgeOffline}`}>
            <FaCircle size={7} />
            {isOnline ? t('devices.online') : t('devices.offline')}
        </span>
    );
};

const DevicesPage = () => {
    const { t, i18n } = useTranslation();

    const [activeCount, setActiveCount]   = useState(0);
    const [totalCount, setTotalCount]     = useState(0);
    const [fillings, setFillings]         = useState([]);
    const [containers, setContainers]     = useState([]);
    const [loading, setLoading]           = useState(true);
    const [showRegister, setShowRegister] = useState(false);
    const [viewContainer, setViewContainer] = useState(null);
    const [toast, setToast] = useState({ open: false, type: 'success', title: '', message: '' });

    const showToast = (type, title, message = '') =>
        setToast({ open: true, type, title, message });

    const loadAll = async () => {
        setLoading(true);
        try {
            const [statsRes, totalRes, fillRes, contRes] = await Promise.all([
                fetchContainerStats(),
                fetchTotalContainers(),
                fetchLatestFillings(),
                fetchAllContainers(),
            ]);
            setActiveCount(statsRes.data.activeCount);
            setTotalCount(totalRes.data.count);
            setFillings(fillRes.data);
            setContainers(contRes.data);
        } catch {
            showToast('error', t('devices.load_error'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadAll(); }, []);

    const handleExport = async () => {
        try {
            const response = await exportContainers();
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url  = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href  = url;
            link.setAttribute('download', 'containers-report.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            showToast('success', t('devices.export_success'));
        } catch {
            showToast('error', t('devices.export_error'));
        }
    };

    const handleDelete = async (container) => {
        if (container.is_online) {
            showToast('error',
                t('devices.delete_online_error') || 'Неможливо видалити',
                t('devices.delete_online_hint') || 'Спочатку відключіть пристрій'
            );
            return;
        }
        if (!window.confirm(
            `${t('devices.delete_confirm') || 'Видалити контейнер'} №${container.container_number}?`
        )) return;

        try {
            await deleteContainer(container.container_id);
            await loadAll();
            showToast('success', t('devices.delete_success') || 'Контейнер видалено');
        } catch (err) {
            showToast('error',
                t('devices.delete_error') || 'Помилка видалення',
                err.response?.data?.message || ''
            );
        }
    };

    if (loading) return <LoaderOverlay />;

    return (
        <div className={styles.pageWrapper}>

            <div className={styles.pageHeader}>
                <div className={styles.titleBlock}>
                    <div className={styles.pageTitleRow}>
                        <h2 className={styles.pageTitle}>{t('devices.title')}</h2>
                    </div>
                    <div className={styles.counts}>
                        <div className={styles.countItem}>
                            <div className={styles.countValue} style={{ color: '#22c55e' }}>{activeCount}</div>
                            <div className={styles.countLabel}>{t('devices.active')}</div>
                        </div>
                        <div className={styles.divider} />
                        <div className={styles.countItem}>
                            <div className={styles.countValue}>{totalCount}</div>
                            <div className={styles.countLabel}>{t('devices.total')}</div>
                        </div>
                    </div>
                </div>

                <div className={styles.actions}>
                    <button className={styles.registerBtn} onClick={() => setShowRegister(true)}>
                        <FaPlus size={13} /> {t('devices.register')}
                    </button>
                    <button className={styles.exportBtn} onClick={handleExport}>
                        <FaFileExport size={13} /> {t('devices.export')}
                    </button>
                </div>
            </div>

            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{t('devices.containers_list')}</h3>

                {containers.length === 0 ? (
                    <div className={styles.empty}>{t('devices.no_containers')}</div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                            <tr>
                                <th>{t('devices.table.number')}</th>
                                <th>{t('devices.table.uid')}</th>
                                <th>{t('devices.table.status')}</th>
                                <th>{t('devices.table.patient')}</th>
                                <th>{t('devices.table.last_seen')}</th>
                                <th>{t('devices.table.firmware')}</th>
                                <th style={{ width: 48 }}></th>
                            </tr>
                            </thead>
                            <tbody>
                            {containers.map(c => (
                                <tr
                                    key={c.container_id}
                                    className={styles.clickableRow}
                                    onClick={() => setViewContainer(c)}
                                >
                                    <td>
                                            <span className={styles.containerNumber}>
                                                №{c.container_number || c.container_id}
                                            </span>
                                    </td>
                                    <td>
                                        <code className={styles.uid}>{c.device_uid || '—'}</code>
                                    </td>
                                    <td><StatusBadge isOnline={c.is_online} /></td>
                                    <td>
                                        {c.users ? (
                                            <div className={styles.patientCell}>
                                                <FaUser size={12} className={styles.patientIcon} />
                                                {c.users.last_name} {c.users.first_name}
                                            </div>
                                        ) : (
                                            <span className={styles.noPatient}>{t('devices.no_patient')}</span>
                                        )}
                                    </td>
                                    <td className={styles.dateCell}>
                                        {formatDateTime(c.last_seen, i18n.language)}
                                    </td>
                                    <td>
                                        {c.firmware_version
                                            ? <span className={styles.firmware}>{c.firmware_version}</span>
                                            : '—'
                                        }
                                    </td>
                                    <td onClick={e => e.stopPropagation()}>
                                        <button
                                            className={styles.deleteBtn}
                                            onClick={() => handleDelete(c)}
                                            title={t('devices.delete_confirm') || 'Видалити'}
                                            disabled={c.is_online}
                                        >
                                            <FaTrashAlt size={13} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{t('devices.latest_fillings')}</h3>

                {fillings.length === 0 ? (
                    <div className={styles.empty}>{t('devices.no_fillings')}</div>
                ) : (
                    <div className={styles.fillList}>
                        {fillings.map((item, index) => (
                            <div key={index} className={styles.fillItem}>
                                <div className={styles.fillIcon}>
                                    <FaCheckCircle size={14} />
                                </div>
                                <div className={styles.fillInfo}>
                                    <span className={styles.fillText}>
                                        {t('devices.device')} <strong>№{item.device_code}</strong>,{' '}
                                        {t('devices.compartment')} <strong>№{item.compartment_number}</strong>
                                    </span>
                                    <span className={styles.fillMeta}>
                                        {item.filled_by} · {formatTime(item.fill_time)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showRegister && (
                <RegisterModal
                    onClose={() => setShowRegister(false)}
                    onSuccess={() => {
                        loadAll();
                        showToast('success', t('devices.registered_success'));
                    }}
                />
            )}

            {viewContainer && (
                <ContainerModal
                    container={viewContainer}
                    onClose={() => setViewContainer(null)}
                />
            )}

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

export default DevicesPage;