import React, { useState } from 'react';
import styles from '../PatientDetailsPage.module.css';
import defaultAvatar from '../../../assets/default_avatar.svg';
import { deletePatient } from '../../../services/patientService';
import { useNavigate } from 'react-router-dom';
import EditPatientModal from '../../../components/Patients/EditPatientModal';
import { useTranslation } from 'react-i18next';

const PatientInfo = ({ patient, setPatient, onAdd, onDownloadReport, role }) => {
    const navigate = useNavigate();

    const [showEditModal, setShowEditModal] = useState(false);
    const { t } = useTranslation();


    return (
        <div className={styles.patientInfoCard}>
            <img src={patient.avatar || defaultAvatar} alt="Avatar" className={styles.avatar} />
            <h3 className={styles.name}>{patient.name}</h3>
            <p className={styles.info}>{patient.dob}</p>
            <p className={styles.info}>{patient.email}</p>
            <p className={styles.info}>{patient.phone}</p>
            <p className={styles.info}>{patient.address}</p>

            {role !== 'admin' && (
                <div className={styles.buttonBlock}>
                    <button className={styles.editButton} onClick={() => setShowEditModal(true)}>
                        {t('patient_info.edit')}
                    </button>
                    <button
                        className={styles.deleteButton}
                        onClick={() => {
                            if (window.confirm(t('patient_info.confirm_delete'))) {
                                deletePatient(patient.id)
                                    .then(() => {
                                        navigate('/main/patients');
                                    })
                                    .catch(err => {
                                        console.error('Помилка при видаленні:', err);
                                        alert(t('patient_info.delete_failed'));
                                    });
                            }
                        }}
                    >
                        {t('patient_info.delete')}
                    </button>
                </div>
            )}

            <div className={styles.actionButtons}>
                {role !== 'admin' && (
                    <button
                        className={styles.primaryButton}
                        onClick={onAdd}
                    >
                        {t('patient_info.add_prescription')}
                    </button>
                )}
                <button
                    className={styles.secondaryButton}
                    onClick={() => onDownloadReport(patient.id)}
                >
                    {t('patient_info.download_report')}
                </button>
            </div>
            {showEditModal && (
                <EditPatientModal
                    patient={patient}
                    setPatient={setPatient}
                    onClose={() => setShowEditModal(false)}
                />
            )}
        </div>
    );
};

export default PatientInfo;
