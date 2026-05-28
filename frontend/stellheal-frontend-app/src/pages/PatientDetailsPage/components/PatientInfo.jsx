import React, { useState } from 'react';
import styles from '../PatientDetailsPage.module.css';
import defaultAvatar from '../../../assets/icons/default_avatar.svg';
import { deletePatient } from '../../../services/patientService';
import { useNavigate } from 'react-router-dom';
import EditPatientModal from '../../PatientsPage/modals/AddEditPatientModal/EditPatientModal';
import { useTranslation } from 'react-i18next';
import { FaUserEdit, FaTrash, FaPlus, FaFileDownload, FaChartBar, FaPaperclip } from 'react-icons/fa';
import {MdEditDocument} from "react-icons/md";

const PatientInfo = ({ patient, setPatient, onAdd, onDownloadReport, role }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [showEditModal, setShowEditModal] = useState(false);

    const handleDelete = () => {
        if (window.confirm(t('patient_info.confirm_delete'))) {
            deletePatient(patient.id)
                .then(() => navigate('/main/patients'))
                .catch(err => {
                    console.error('Помилка при видаленні:', err);
                    alert(t('patient_info.delete_failed'));
                });
        }
    };

    return (
        <div className={styles.patientInfoCard}>
            <img src={patient.avatar || defaultAvatar} alt={t('patient_info.avatar_alt')} className={styles.avatar} />
            <h3 className={styles.name}>{patient.name}</h3>

            <div className={styles.infoList}>
                {patient.dob && (
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>{t('patient_info.dob')}</span>
                        <span className={styles.infoValue}>{patient.dob}</span>
                    </div>
                )}
                {patient.email && (
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>{t('patient_info.email')}</span>
                        <span className={styles.infoValue}>{patient.email}</span>
                    </div>
                )}
                {patient.phone && (
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>{t('patient_info.phone')}</span>
                        <span className={styles.infoValue}>{patient.phone}</span>
                    </div>
                )}
                {patient.address && (
                    <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>{t('patient_info.address')}</span>
                        <span className={styles.infoValue}>{patient.address}</span>
                    </div>
                )}
            </div>

            {/* Дії — призначення і звіти */}
            <div className={styles.actionButtons}>
                {role !== 'admin' && (
                    <button
                        className={styles.primaryButton}
                        onClick={() => navigate(`/main/patients/${patient.id}/prescription/new`)}
                    >
                        <MdEditDocument size={13} /> {t('patient_info.add_prescription')}
                    </button>
                )}
                {role !== 'admin' && (
                    <button
                        className={styles.secondaryButton}
                        onClick={() => navigate(`/main/patients/${patient.id}/files`)}
                    >
                        <FaPaperclip size={13} /> {t('patient_info.tests_and_research')}
                    </button>
                )}
                <button
                    className={styles.secondaryButton}
                    onClick={() => onDownloadReport(patient.id)}
                >
                    <FaFileDownload size={13} /> {t('patient_info.download_report')}
                </button>
            </div>

            {/* Дії над пацієнтом */}
            {role !== 'admin' && (
                <div className={styles.buttonBlock}>
                    <button className={styles.editButton} onClick={() => setShowEditModal(true)}>
                        {t('patient_info.edit')}
                    </button>
                    <button className={styles.deleteButton} onClick={handleDelete}>
                        {t('patient_info.delete')}
                    </button>
                </div>
            )}

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