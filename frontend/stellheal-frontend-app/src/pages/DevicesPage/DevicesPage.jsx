import React, { useEffect, useState } from 'react';
import styles from './DevicesPage.module.css';
import { fetchContainerStats, fetchLatestFillings, fetchTotalContainers, exportContainers } from '../../services/containerService';
import { FaFileExport } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const DevicesPage = () => {
    const [activeCount, setActiveCount] = useState(0);
    const [inactiveCount, setInactiveCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [fillings, setFillings] = useState([]);
    const { t } = useTranslation();

    useEffect(() => {
        const loadStats = async () => {
            try {
                const [statsRes, totalRes] = await Promise.all([
                    fetchContainerStats(),
                    fetchTotalContainers()
                ]);
                setActiveCount(statsRes.data.activeCount);
                setInactiveCount(statsRes.data.inactiveCount);
                setTotalCount(totalRes.data.count);
            } catch (err) {
                console.error('Помилка при завантаженні статистики:', err);
            }
        };

        const loadFillings = async () => {
            try {
                const res = await fetchLatestFillings();
                setFillings(res.data);
            } catch (err) {
                console.error('Помилка при завантаженні заповнень:', err);
            }
        };

        loadStats();
        loadFillings();
    }, []);

    const handleExport = async () => {
        try {
            const response = await exportContainers();
            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'containers-report.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Помилка експорту:', err);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.headerPanel}>
                <div className={styles.titleBlock}>
                    <h3 className={styles.pageTitle}>{t('devices.title')}</h3>
                    <div className={styles.counts}>
                        <div className={styles.countItem}>
                            <div className={styles.countValue}>{activeCount}</div>
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
                    <button className={styles.exportBtn} onClick={handleExport}>
                        <FaFileExport className={styles.icon} />
                        {t('devices.export')}
                    </button>
                </div>
            </div>

            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{t('devices.latest_fillings')}</h3>
                <ul className={styles.logList}>
                    {fillings.map((item, index) => (
                        <li key={index} className={styles.logItem}>
                            <span className={styles.logText}>
                                {t('devices.device')} №{item.device_code}, {t('devices.compartment')} №{item.compartment_number} - {t('devices.filled_at')} {item.time} - {item.filled_by}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default DevicesPage;
