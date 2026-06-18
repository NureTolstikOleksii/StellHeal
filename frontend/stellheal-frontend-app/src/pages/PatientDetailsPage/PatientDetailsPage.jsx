import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './PatientDetailsPage.module.css';
import PatientInfo from './components/PatientInfo';
import CurrentTreatment from './components/CurrentTreatment';
import TreatmentHistory from './components/TreatmentHistory';
import YearSelector from './components/YearSelector';
import {
    getPatientById,
    getCurrentTreatment,
    getTreatmentHistory,
    deletePrescription,
    downloadPatientReport
} from '../../services/patientService';

import { useAuth } from '../../context/AuthContext.jsx';
import { useTranslation } from 'react-i18next';
import LoaderOverlay from "../../components/LoaderOverlay/LoaderOverlay.jsx";

const PatientDetailsPage = () => {
    const { t } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();
    const [patient, setPatient] = useState(null);
    const [currentTreatment, setCurrentTreatment] = useState([]);
    const [treatmentHistory, setTreatmentHistory] = useState([]);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(true);
    const [_, setShowModal] = useState(false);
    const { user } = useAuth();
    const role = user?.role;


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

    if (loading) return <LoaderOverlay />;
    if (!patient) return <div className={styles.error}>{t('patient_details.not_found')}</div>;

    return (
        <div className={styles.pageWrapper}>

            <div className={styles.pageHeader}>
                <div>
                    <div className={styles.breadcrumb}>
                        <span className={styles.breadcrumbLink} onClick={() => navigate('/main/patients')}>
                            {t('patients.title')}
                        </span>
                        <span className={styles.breadcrumbSep}>/</span>
                        <span>{patient.name}</span>
                    </div>
                    <div className={styles.pageTitleRow}>
                        <h2 className={styles.pageTitle}>{patient.name}</h2>
                    </div>
                </div>
                {/*<div className={styles.patientBadge}>*/}
                {/*    <img src={patient.avatar || '/default_avatar.svg'} alt="" className={styles.patientAvatar} />*/}
                {/*    <div>*/}
                {/*        <div className={styles.patientName}>{patient.name}</div>*/}
                {/*        <div className={styles.patientMeta}>{calcAge(patient.dob)} р. · {patient.phone}</div>*/}
                {/*    </div>*/}
                {/*</div>*/}
            </div>

            <div className={styles.contentRow}>
                <div className={styles.mainContent}>
                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>{t('patient_details.current_treatment')}</h3>
                        <CurrentTreatment
                            treatment={currentTreatment}
                            onDelete={handleDelete}
                            role={role}
                            patientId={id}
                        />
                    </section>

                    <section className={styles.section}>
                        <div className={styles.historyHeader}>
                            <h3 className={styles.sectionTitle}>{t('patient_details.treatment_history')}</h3>
                            <YearSelector selectedYear={selectedYear} onChange={setSelectedYear} />
                        </div>
                        <TreatmentHistory history={treatmentHistory} year={selectedYear} patientId={id} />
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
            </div>
        </div>
    );
};

export default PatientDetailsPage;