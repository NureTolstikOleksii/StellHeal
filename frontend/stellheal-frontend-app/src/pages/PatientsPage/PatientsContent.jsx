import React, { useEffect, useState } from 'react';
import { fetchPatients } from '../../services/patientService';
import styles from './PatientsPage.module.css';
import { useTranslation } from "react-i18next";
import { useNavigate } from 'react-router-dom';
import defaultAvatar from '../../assets/default_avatar.svg';

const PatientsContent = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [patients, setPatients] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState('lastName');

    useEffect(() => {
        const loadPatients = async () => {
            try {
                const data = await fetchPatients();
                if (Array.isArray(data)) {
                    setPatients(data);
                } else {
                    console.error('Data is not an array:', data);
                    setPatients([]);
                }
            } catch (err) {
                console.error('Failed to load patients:', err);
                setPatients([]);
            }
        };
        loadPatients();
    }, []);

    const filtered = Array.isArray(patients)
        ? patients
            .filter(p =>
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.email.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => {
                if (sortKey === 'lastName') return a.name.localeCompare(b.name);
                if (sortKey === 'birthDate') return new Date(a.dob) - new Date(b.dob);
                return 0;
            })
        : [];

    const handleRowClick = (id) => navigate(`/main/patients/${id}`);

    return (
        <>
            <div className={styles.searchPanel}>
                <h3 className={styles.pageTitle}>{t('patients.search_title')}</h3>
                <div className={styles.topRow}>
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder={t('patients.search_placeholder')}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <div className={styles.sortGroup}>
                        <label htmlFor="sort" className={styles.sortLabel}>
                            {t('patients.sort_by')}
                        </label>
                        <select
                            id="sort"
                            className={styles.sortSelect}
                            value={sortKey}
                            onChange={e => setSortKey(e.target.value)}
                        >
                            <option value="lastName">{t('patients.sort_last_name')}</option>
                            <option value="birthDate">{t('patients.sort_birth_date')}</option>
                        </select>
                    </div>
                </div>
            </div>

            <table className={styles.patientsTable}>
                <thead>
                <tr>
                    <th>{t('patients.table.user')}</th>
                    <th>{t('patients.table.phone')}</th>
                    <th>{t('patients.table.email')}</th>
                    <th>{t('patients.table.dob')}</th>
                    <th>{t('patients.table.address')}</th>
                </tr>
                </thead>
                <tbody>
                {filtered.length > 0 ? (
                    filtered.map((patient, index) => (
                        <tr key={index} onClick={() => handleRowClick(patient.id)} className={styles.clickableRow}>
                            <td>
                                <div className={styles.userCell}>
                                    <img
                                        src={patient.avatar || defaultAvatar}
                                        alt="avatar"
                                        className={styles.userAvatar}
                                    />
                                    {patient.name}
                                </div>
                            </td>
                            <td>{patient.phone}</td>
                            <td>{patient.email}</td>
                            <td>{patient.dob}</td>
                            <td>{patient.address}</td>
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '16px' }}>
                            {t('patients.no_results')}
                        </td>
                    </tr>
                )}
                </tbody>
            </table>
        </>
    );
};

export default PatientsContent;
