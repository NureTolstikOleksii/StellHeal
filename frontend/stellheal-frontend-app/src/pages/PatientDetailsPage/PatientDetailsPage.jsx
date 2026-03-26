import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import styles from './PatientDetailsPage.module.css';
import PatientInfo from './components/PatientInfo';
import CurrentTreatment from './components/CurrentTreatment';
import TreatmentHistory from './components/TreatmentHistory';
import YearSelector from './components/YearSelector';
import {
    getPatientById,
    getCurrentTreatment,
    getTreatmentHistory,
    createPrescription,
    deletePrescription,
    downloadPatientReport
} from '../../services/patientService';
import AddPrescriptionModal from './components/AddPrescriptionModal';
import { useAuth } from "../../context/AuthContext.jsx";
import { useTranslation } from "react-i18next";

const PatientDetailsPage = () => {
    const { t } = useTranslation();
    const { id } = useParams();
    const [patient, setPatient] = useState(null);
    const [currentTreatment, setCurrentTreatment] = useState([]);
    const [treatmentHistory, setTreatmentHistory] = useState([]);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const { user } = useAuth();
    const role = user?.role;

    const handleCreatePrescription = async (data) => {
        try {
            await createPrescription(id, data);
            setShowModal(false);
            const updatedCurrent = await getCurrentTreatment(id);
            const updatedHistory = await getTreatmentHistory(id);
            setCurrentTreatment(updatedCurrent);
            setTreatmentHistory(updatedHistory);
        } catch (err) {
            console.error('Не вдалося створити призначення:', err);
            alert(t('patient_details.create_error'));
        }
    };

    useEffect(() => {
        const loadAll = async () => {
            try {
                const patientData = await getPatientById(id);
                const current = await getCurrentTreatment(id);
                const history = await getTreatmentHistory(id);

                setPatient(patientData);
                setCurrentTreatment(current);
                setTreatmentHistory(history);
            } catch (err) {
                console.error('Помилка при завантаженні сторінки пацієнта:', err);
            } finally {
                setLoading(false);
            }
        };
        loadAll();
    }, [id]);

    const handleDelete = async (prescriptionId) => {
        try {
            await deletePrescription(prescriptionId);
            const updated = await getCurrentTreatment(id);
            setCurrentTreatment(updated);
        } catch (err) {
            console.error('Помилка при видаленні:', err);
            alert(t('patient_details.delete_error'));
        }
    };

    const handleDownloadReport = (patientId) => {
        downloadPatientReport(patientId);
    };

    if (loading) return <div className={styles.loading}>{t('patient_details.loading')}</div>;
    if (!patient) return <div className={styles.error}>{t('patient_details.not_found')}</div>;

    return (
        <div className={styles.pageWrapper}>
            <div className={styles.mainContent}>
                <section className={styles.section}>
                    <h3>{t('patient_details.current_treatment')}</h3>
                    <CurrentTreatment treatment={currentTreatment} onDelete={handleDelete} role={role} />
                </section>

                <section className={styles.section}>
                    <div className={styles.historyHeader}>
                        <h3>{t('patient_details.treatment_history')}</h3>
                        <YearSelector
                            selectedYear={selectedYear}
                            onChange={setSelectedYear}
                        />
                    </div>
                    <TreatmentHistory
                        history={treatmentHistory}
                        year={selectedYear}
                    />
                </section>
            </div>
            <div className={styles.sidebar}>
                <PatientInfo
                    patient={patient}
                    setPatient={setPatient}
                    onAdd={() => setShowModal(true)}
                    onDownloadReport={handleDownloadReport}
                    role={role}
                />
            </div>
            {showModal && (
                <AddPrescriptionModal
                    onClose={() => setShowModal(false)}
                    onSubmit={handleCreatePrescription}
                />
            )}
        </div>
    );
};

export default PatientDetailsPage;
