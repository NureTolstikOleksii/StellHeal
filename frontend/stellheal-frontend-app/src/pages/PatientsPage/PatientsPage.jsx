import React, { useState, useEffect } from 'react';
import styles from './PatientsPage.module.css';
import PatientsHeader from './components/PatientsHeader.jsx';
import PatientsContent from './components/PatientsContent.jsx';
import AddPatientModal from './modals/AddEditPatientModal/AddPatientModal';
import { useAuth } from '../../context/AuthContext.jsx';
import { fetchPatients } from '../../services/patientService';

const PatientsPage = () => {
    const [showModal, setShowModal] = useState(false);
    const { user } = useAuth();
    const role = user?.role;

    const [patients, setPatients] = useState([]);
    const [loading, setLoading]   = useState(true);

    useEffect(() => {
        const loadPatients = async () => {
            try {
                const data = await fetchPatients();
                const list = Array.isArray(data) ? data : [];
                const v = Date.now();
                setPatients(list.map(p => ({
                    ...p,
                    avatar: p.avatar ? `${p.avatar}?t=${v}` : null,
                })));
            } catch (err) {
                console.error('Failed to fetch patients:', err);
                setPatients([]);
            } finally {
                setLoading(false);
            }
        };
        loadPatients();
    }, []);

    return (
        <div className={styles.wrapper}>
            <PatientsHeader onAdd={() => setShowModal(true)} role={role} />
            {showModal && (
                <AddPatientModal
                    onClose={() => setShowModal(false)}
                    setPatients={setPatients}
                />
            )}
            <PatientsContent patients={patients} loading={loading} />
        </div>
    );
};

export default PatientsPage;