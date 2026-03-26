import React, { useEffect, useState } from 'react';
import styles from './StatsPage.module.css';
import { fetchClinicStats, fetchDoctorStats } from '../../services/statsService';
import { useTranslation } from 'react-i18next';

const StatsPage = () => {
    const { t } = useTranslation();
    const [clinicStats, setClinicStats] = useState(null);
    const [doctorStats, setDoctorStats] = useState([]);

    useEffect(() => {
        const loadStats = async () => {
            try {
                const clinic = await fetchClinicStats();
                const doctors = await fetchDoctorStats();
                setClinicStats(clinic.data);
                setDoctorStats(doctors.data);
            } catch (err) {
                console.error('Помилка завантаження статистики:', err);
            }
        };
        loadStats();
    }, []);

    return (
        <div className={styles.container}>
            <div className={styles.headerPanel}>
                <div className={styles.titleBlock}>
                    <h3 className={styles.pageTitle}>{t('stats.clinic_title')}</h3>
                    {clinicStats && (
                        <div className={styles.counts}>
                            <div className={styles.countItem}>
                                <div className={styles.countValue}>{clinicStats.activePatients}</div>
                                <div className={styles.countLabel}>{t('stats.active_patients')}</div>
                            </div>
                            <div className={styles.divider} />
                            <div className={styles.countItem}>
                                <div className={styles.countValue}>{clinicStats.medicalStaff}</div>
                                <div className={styles.countLabel}>{t('stats.medical_staff')}</div>
                            </div>
                            <div className={styles.divider} />
                            <div className={styles.countItem}>
                                <div className={styles.countValue}>{clinicStats.treatmentPlans}</div>
                                <div className={styles.countLabel}>{t('stats.treatment_plans')}</div>
                            </div>
                            <div className={styles.divider} />
                            <div className={styles.countItem}>
                                <div className={styles.countValue}>{clinicStats.deviceTriggers}</div>
                                <div className={styles.countLabel}>{t('stats.device_triggers')}</div>
                            </div>
                            <div className={styles.divider} />
                            <div className={styles.countItem}>
                                <div className={styles.countValue}>{clinicStats.missedAppointments}</div>
                                <div className={styles.countLabel}>{t('stats.missed_appointments')}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className={styles.panel}>
                <h3 className={styles.sectionTitle}>{t('stats.doctor_stats')}</h3>
                <div className={styles.doctorStats}>
                    {doctorStats.map((doc, i) => (
                        <p key={i}>
                            {doc.name} - {t('stats.patients')}: {doc.patients}, {t('stats.active_assignments')}: {doc.active}
                        </p>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StatsPage;