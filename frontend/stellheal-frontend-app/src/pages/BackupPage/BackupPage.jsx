import React, { useState, useEffect } from 'react';
import styles from './BackupPage.module.css';
import {
    getBackupList,
    triggerManualBackup,
    restoreBackup,
    deleteBackup,
} from '../../services/backupService';
import { useTranslation } from 'react-i18next';
import {
    FiDownload, FiRefreshCw, FiTrash2,
    FiAlertTriangle, FiDatabase, FiCheckCircle,
} from 'react-icons/fi';
import { FaDatabase } from 'react-icons/fa';
import LoaderOverlay from '../../components/LoaderOverlay/LoaderOverlay';
import Toast from '../../components/Toast/Toast';

// ── Confirm modal ─────────────────────────────────────────────────────────────
const ConfirmModal = ({ title, message, danger, onConfirm, onClose }) => (
    <div className={styles.overlay} onClick={onClose}>
        <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmIcon}>
                {danger ? <FiAlertTriangle size={28} color="#ef4444" /> : <FiDatabase size={28} color="#1976d2" />}
            </div>
            <h3 className={styles.confirmTitle}>{title}</h3>
            <p className={styles.confirmText}>{message}</p>
            <div className={styles.confirmActions}>
                <button className={styles.cancelBtn} onClick={onClose}>
                    Скасувати
                </button>
                <button
                    className={danger ? styles.dangerBtn : styles.primaryBtn}
                    onClick={onConfirm}
                >
                    Підтвердити
                </button>
            </div>
        </div>
    </div>
);

// ── Format size ───────────────────────────────────────────────────────────────
const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 ** 2)   return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

// ── Main ──────────────────────────────────────────────────────────────────────
const BackupPage = () => {
    const { t, i18n } = useTranslation();

    const [backups, setBackups]     = useState([]);
    const [loading, setLoading]     = useState(true);
    const [creating, setCreating]   = useState(false);
    const [confirm, setConfirm]     = useState(null); // { type, backup }
    const [actionLoading, setActionLoading] = useState(false);
    const [toast, setToast] = useState({ open: false, type: 'success', title: '', message: '' });

    const showToast = (type, title, message = '') =>
        setToast({ open: true, type, title, message });

    const loadBackups = async () => {
        setLoading(true);
        try {
            const res = await getBackupList();
            setBackups(res.data || []);
        } catch {
            showToast('error', t('backup.load_error') || 'Помилка завантаження');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadBackups(); }, []);

    const handleCreate = async () => {
        setCreating(true);
        try {
            await triggerManualBackup();
            await loadBackups();
            showToast('success', t('backup.created') || 'Резервну копію створено');
        } catch (err) {
            showToast('error',
                t('backup.create_error') || 'Помилка створення',
                err.response?.data?.message || ''
            );
        } finally {
            setCreating(false);
        }
    };

    const handleRestore = async (backup) => {
        setConfirm({ type: 'restore', backup });
    };

    const handleDelete = async (backup) => {
        setConfirm({ type: 'delete', backup });
    };

    const handleConfirm = async () => {
        const { type, backup } = confirm;
        setConfirm(null);
        setActionLoading(true);
        try {
            if (type === 'restore') {
                await restoreBackup(backup.name);
                showToast('success',
                    t('backup.restored') || 'Відновлено',
                    t('backup.restored_hint') || 'Базу даних відновлено успішно'
                );
            } else {
                await deleteBackup(backup.name);
                await loadBackups();
                showToast('success', t('backup.deleted') || 'Бекап видалено');
            }
        } catch (err) {
            showToast('error',
                type === 'restore'
                    ? (t('backup.restore_error') || 'Помилка відновлення')
                    : (t('backup.delete_error') || 'Помилка видалення'),
                err.response?.data?.message || ''
            );
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (isoDate) => {
        if (!isoDate) return '—';
        return new Date(isoDate).toLocaleString(
            i18n.language === 'uk' ? 'uk-UA' : 'en-US',
            { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        );
    };

    if (loading) return <LoaderOverlay />;

    const latestBackup = backups[0];

    return (
        <div className={styles.pageWrapper}>

            {/* ── Header ── */}
            <div className={styles.pageHeader}>
                <div className={styles.pageTitleRow}>
                    <FaDatabase className={styles.pageTitleIcon} />
                    <h2 className={styles.pageTitle}>{t('backup.title')}</h2>
                </div>
            </div>

            {/* ── Status card ── */}
            <div className={styles.statusCard}>
                <div className={styles.statusLeft}>
                    <div className={`${styles.statusIcon} ${latestBackup ? styles.statusOk : styles.statusWarn}`}>
                        {latestBackup
                            ? <FiCheckCircle size={22} />
                            : <FiAlertTriangle size={22} />
                        }
                    </div>
                    <div>
                        <div className={styles.statusTitle}>
                            {latestBackup
                                ? (t('backup.last') || 'Остання резервна копія')
                                : (t('backup.no_backups') || 'Резервних копій ще немає')
                            }
                        </div>
                        {latestBackup && (
                            <div className={styles.statusDate}>
                                {formatDate(latestBackup.lastModified)} · {formatSize(latestBackup.size)}
                            </div>
                        )}
                    </div>
                </div>
                <button
                    className={styles.createBtn}
                    onClick={handleCreate}
                    disabled={creating || actionLoading}
                >
                    {creating
                        ? <><FiRefreshCw size={14} className={styles.spin} /> {t('backup.creating') || 'Створення...'}</>
                        : <><FiDownload size={14} /> {t('backup.now') || 'Створити бекап'}</>
                    }
                </button>
            </div>

            {/* ── Backups list ── */}
            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>{t('backup.list') || 'Резервні копії'}</h3>
                    <span className={styles.sectionCount}>{backups.length}</span>
                </div>

                {backups.length === 0 ? (
                    <div className={styles.empty}>
                        <FiDatabase size={32} color="#d1d5db" />
                        <p>{t('backup.no_backups') || 'Резервних копій немає'}</p>
                    </div>
                ) : (
                    <div className={styles.backupList}>
                        {backups.map((b, i) => (
                            <div key={b.name} className={`${styles.backupItem} ${i === 0 ? styles.backupItemLatest : ''}`}>
                                <div className={styles.backupIcon}>
                                    <FiDatabase size={16} />
                                </div>
                                <div className={styles.backupInfo}>
                                    <div className={styles.backupName}>{b.name}</div>
                                    <div className={styles.backupMeta}>
                                        {formatDate(b.lastModified)} · {formatSize(b.size)}
                                    </div>
                                </div>
                                {i === 0 && (
                                    <span className={styles.latestBadge}>
                                        {t('backup.latest') || 'Остання'}
                                    </span>
                                )}
                                <div className={styles.backupActions}>
                                    <button
                                        className={styles.restoreBtn}
                                        onClick={() => handleRestore(b)}
                                        disabled={actionLoading}
                                        title={t('backup.restore') || 'Відновити'}
                                    >
                                        <FiRefreshCw size={14} />
                                        {t('backup.restore') || 'Відновити'}
                                    </button>
                                    <button
                                        className={styles.deleteBtn}
                                        onClick={() => handleDelete(b)}
                                        disabled={actionLoading}
                                        title={t('backup.delete') || 'Видалити'}
                                    >
                                        <FiTrash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Warning ── */}
            <div className={styles.warningBlock}>
                <FiAlertTriangle size={16} className={styles.warningIcon} />
                <p className={styles.warningText}>
                    {t('backup.restore_warning') ||
                        'Увага: відновлення з резервної копії замінить усі поточні дані. Цю дію неможливо скасувати.'}
                </p>
            </div>

            {/* ── Confirm modal ── */}
            {confirm && (
                <ConfirmModal
                    danger={confirm.type === 'restore' || confirm.type === 'delete'}
                    title={
                        confirm.type === 'restore'
                            ? (t('backup.restore_confirm_title') || 'Відновити базу даних?')
                            : (t('backup.delete_confirm_title') || 'Видалити бекап?')
                    }
                    message={
                        confirm.type === 'restore'
                            ? (t('backup.restore_confirm_text') || `Всі поточні дані будуть замінені даними з копії "${confirm.backup.name}". Цю дію неможливо скасувати.`)
                            : (t('backup.delete_confirm_text') || `Бекап "${confirm.backup.name}" буде видалено назавжди.`)
                    }
                    onConfirm={handleConfirm}
                    onClose={() => setConfirm(null)}
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

export default BackupPage;