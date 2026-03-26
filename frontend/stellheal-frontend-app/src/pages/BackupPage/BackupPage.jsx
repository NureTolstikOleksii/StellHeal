import React, { useState, useEffect } from 'react';
import styles from './BackupPage.module.css';
import { getLastBackupTime, triggerManualBackup } from '../../services/backupService';
import { useTranslation } from 'react-i18next';
import { FiDownload } from 'react-icons/fi';

const BackupPage = () => {
    const { t, i18n } = useTranslation();
    const [lastBackup, setLastBackup] = useState(null);
    const autoTime = t('backup.auto_time');

    useEffect(() => {
        const fetchData = async () => {
            const res = await getLastBackupTime();
            setLastBackup(res.data?.lastBackup);
        };
        fetchData();
    }, []);

    const handleBackupNow = async () => {
        const res = await triggerManualBackup();
        if (res.data?.timestamp) {
            setLastBackup(res.data.timestamp);
        }
    };

    const formatDate = (isoDate) => {
        const date = new Date(isoDate);
        return date.toLocaleString(i18n.language === 'uk' ? 'uk-UA' : 'en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div>
                    <h3 className={styles.title}>{t('backup.title')}</h3>
                    <p className={styles.text}>
                        {t('backup.last')}{' '}
                        {lastBackup ? formatDate(lastBackup) : t('backup.loading')}
                    </p>
                </div>
                <button className={styles.backupButton} onClick={handleBackupNow}>
                    <FiDownload className={styles.icon} />
                    {t('backup.now')}
                </button>
            </div>
        </div>
    );
};

export default BackupPage;
