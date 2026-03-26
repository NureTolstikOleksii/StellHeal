import React from 'react';
import styles from '../PatientDetailsPage.module.css';
import { FaBed, FaUserMd, FaClock, FaCheckCircle } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const DiagnosisCard = ({ diagnosis, isHistory, onDelete, role }) => {

    console.log(diagnosis.endDate);
    const { t } = useTranslation();

    const handleDelete = () => {
        if (window.confirm(t('diagnosis_card.confirm_delete'))) {
            onDelete(diagnosis.prescriptionId);
        }
    };

    const formattedDate = new Date(diagnosis.date).toLocaleDateString('uk-UA');
    const formattedDateEnd = new Date(diagnosis.endDate).toLocaleDateString('uk-UA');

    return (
        <div className={styles.card}>
            <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>
                    {diagnosis.name} ({formattedDate} - {formattedDateEnd})
                </span>

                {isHistory ? (
                    <div className={styles.statusDone}>
                        {t('diagnosis_card.completed')} <FaCheckCircle className={styles.statusIcon} />
                    </div>
                ) : role !== 'admin' && (
                    <div className={styles.actions}>
                        <button className={styles.deleteBtn} onClick={handleDelete}>
                            {t('diagnosis_card.delete')}
                        </button>
                    </div>
                )}
            </div>

            <div className={styles.medicationsList}>
                {diagnosis.medications.map((med, index) => (
                    <div key={index} className={styles.medicationItem}>
                        {index + 1}. {med}
                    </div>
                ))}
            </div>

            <div className={styles.detailsRow}>
                <span><FaBed /> {t('diagnosis_card.ward')}: {diagnosis.ward}</span>
                <span><FaUserMd /> {t('diagnosis_card.doctor')}: {diagnosis.doctor}</span>
                <span><FaClock /> {t('diagnosis_card.duration')}: {diagnosis.duration} {t('diagnosis_card.days')}</span>
            </div>
        </div>
    );
};

export default DiagnosisCard;
