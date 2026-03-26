import React, { useState, useEffect } from 'react';
import styles from './PatientsPage.module.css';
import PatientsHeader from './PatientsHeader';
import PatientsContent from './PatientsContent.jsx';
import AddPatientModal from '../../components/Patients/AddPatientModal';
import { useAuth } from "../../context/AuthContext.jsx";
import { fetchPatients } from '../../services/patientService';

const PatientsPage = () => {
    const [showModal, setShowModal] = useState(false);
    const { user } = useAuth();
    const role = user?.role;

    const [patients, setPatients] = useState([]);

    useEffect(() => {
        const loadPatients = async () => {
            try {
                const data = await fetchPatients();
                if (Array.isArray(data)) {
                    setPatients(data);
                }
            } catch (err) {
                console.error('Failed to fetch patients:', err);
            }
        };
        loadPatients();
    }, []);

    return (
        <div className={styles.wrapper}>
            <PatientsHeader
                onAdd={() => setShowModal(true)}
                role={role}
            />
            {showModal &&
                <AddPatientModal
                    onClose={() => setShowModal(false)}
                    setPatients={setPatients}
                />
            }
            <PatientsContent
                patients={patients}
                setPatients={setPatients}
            />
        </div>
    );
};

export default PatientsPage;
