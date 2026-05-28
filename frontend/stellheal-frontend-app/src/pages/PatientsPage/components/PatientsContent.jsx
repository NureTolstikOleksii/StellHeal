import React, { useEffect, useState } from 'react';
import { fetchPatients } from '../../../services/patientService.js';
import styles from '../PatientsPage.module.css';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import defaultAvatar from '../../../assets/icons/default_avatar.svg';
import LoaderOverlay from '../../../components/LoaderOverlay/LoaderOverlay.jsx';
import { FaSearch, FaSortAmountDown } from 'react-icons/fa';

const PatientsContent = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [patients, setPatients] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey]   = useState('lastName');

    useEffect(() => {
        fetchPatients()
            .then(data => setPatients(Array.isArray(data) ? data : []))
            .catch(err => { console.error('Failed to load patients:', err); setPatients([]); })
            .finally(() => setLoading(false));
    }, []);

    const filtered = patients
        .filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.email?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (sortKey === 'lastName') return a.name.localeCompare(b.name);
            if (sortKey === 'birthDate') return new Date(a.dob) - new Date(b.dob);
            return 0;
        });

    if (loading) return <LoaderOverlay inline />;

    return (
        <>
            {/* Search panel */}
            <div className={styles.searchPanel}>
                <div className={styles.searchRow}>
                    <div className={styles.searchInputWrapper}>
                        <FaSearch className={styles.searchIcon} />
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder={t('patients.search_placeholder')}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className={styles.sortGroup}>
                        <span className={styles.sortLabel}>{t('patients.sort_by')}</span>
                        <select
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

            {/* Table */}
            <div className={styles.tableWrapper}>
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
                            <tr
                                key={index}
                                onClick={() => navigate(`/main/patients/${patient.id}`)}
                                className={styles.clickableRow}
                            >
                                <td>
                                    <div className={styles.userCell}>
                                        <img
                                            src={patient.avatar || defaultAvatar}
                                            alt="avatar"
                                            className={styles.userAvatar}
                                        />
                                        <span>{patient.name}</span>
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
                            <td colSpan="5" className={styles.noResults}>
                                {t('patients.no_results')}
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default PatientsContent;