import React, { useEffect, useState } from 'react';
import styles from './PatientsPage.module.css';
import { FaUserPlus, FaFileExport } from 'react-icons/fa';
import { useTranslation } from "react-i18next";
import { fetchPatientsStats, downloadPatientsExcel } from '../../services/patientService';

const PatientsHeader = ({ onAdd, role }) => {
    const { t } = useTranslation();
    const [stats, setStats] = useState({ totalPatients: 0, onTreatment: 0 });
    useEffect(() => {
        const loadStats = async () => {
            try {
                const data = await fetchPatientsStats();
                setStats(data);
            } catch (err) {
                console.error('Failed to fetch patient stats:', err);
            }
        };
        loadStats();
    }, []);

    return (
        <div className={styles.headerPanel}>
            <div className={styles.titleBlock}>
                <div className={styles.titleBlock2}>
                    <h3 className={styles.pageTitle}>{t('patients.title')}</h3>
                </div>
                <div className={styles.counts}>
                    <div className={styles.countItem}>
                        <div className={styles.countValue}>{stats.totalPatients}</div>
                        <div className={styles.countLabel}>{t('patients.registered')}</div>
                    </div>
                    <div className={styles.divider} />
                    <div className={styles.countItem}>
                        <div className={styles.countValue}>{stats.onTreatment}</div>
                        <div className={styles.countLabel}>{t('patients.on_pills')}</div>
                    </div>
                </div>
            </div>

            <div className={styles.actions}>
                {role !== 'admin' && (
                    <button className={styles.addBtn} onClick={onAdd}>
                        <FaUserPlus className={styles.icon} />
                        {t('patients.add_patient')}
                    </button>
                )}
                <button className={styles.exportBtn} onClick={downloadPatientsExcel}>
                    <FaFileExport className={styles.icon} />
                    {t('patients.export')}
                </button>
            </div>
        </div>
    );
};

export default PatientsHeader;
