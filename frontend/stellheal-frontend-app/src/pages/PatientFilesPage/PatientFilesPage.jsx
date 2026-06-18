import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    FaSpinner, FaExternalLinkAlt, FaFolderOpen,
    FaXRay, FaBrain, FaHeartbeat, FaFileAlt
} from 'react-icons/fa';
import { GiVial, GiMegaphone } from 'react-icons/gi';
import { useTranslation } from 'react-i18next';
import styles from './PatientFilesPage.module.css';
import { getPatientById, getAllPatientFiles } from '../../services/patientService';
import LoaderOverlay from "../../components/LoaderOverlay/LoaderOverlay.jsx";
import {formatDate} from "../../utils/dateTime.js";
import i18n from "i18next";

const FILE_TYPE_COLORS = {
    analysis: '#e3f2fd',
    xray:     '#f3e5f5',
    mri:      '#e8f5e9',
    ecg:      '#fce4ec',
    uzi:      '#fff3e0',
    other:    '#f5f5f5',
};

const PatientFilesPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [patient, setPatient]   = useState(null);
    const [files, setFiles]       = useState([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState(null);
    const [filter, setFilter]     = useState('all');

    useEffect(() => {
        Promise.all([getPatientById(id), getAllPatientFiles(id)])
            .then(([p, f]) => { setPatient(p); setFiles(f); })
            .catch(() => setError(t('patient_files.load_error')))
            .finally(() => setLoading(false));
    }, [id, t]);

    const getFileTypeLabel = (type) => {
        const iconSize = 14;
        const types = {
            analysis: { icon: <GiVial size={iconSize} color="#1e88e5" />, text: t('file_types.analysis') },
            xray:     { icon: <FaXRay size={iconSize} color="#8e24aa" />, text: t('file_types.xray') },
            mri:      { icon: <FaBrain size={iconSize} color="#43a047" />, text: t('file_types.mri') },
            ecg:      { icon: <FaHeartbeat size={iconSize} color="#e91e63" />, text: t('file_types.ecg') },
            uzi:      { icon: <GiMegaphone size={iconSize} color="#f57c00" style={{ transform: 'rotate(90deg)' }} />, text: t('file_types.uzi') },
            other:    { icon: <FaFileAlt size={iconSize} color="#757575" />, text: t('file_types.other') },
        };

        return types[type] || { icon: <FaFileAlt size={iconSize} />, text: t('file_types.default_file') };
    };

    const filtered = filter === 'all'
        ? files
        : files.filter(f => f.file_type === filter);

    const counts = files.reduce((acc, f) => {
        acc[f.file_type] = (acc[f.file_type] || 0) + 1;
        return acc;
    }, {});

    if (loading) return <LoaderOverlay />

    if (error) return <div className={styles.centered}>{error}</div>;

    return (
        <div className={styles.pageWrapper}>

            {/* Header */}
            <div className={styles.pageHeader}>
                <div>
                    <div className={styles.breadcrumb}>
                        <span className={styles.breadcrumbLink} onClick={() => navigate('/main/patients')}>
                            {t('patient_files.breadcrumb_patients')}
                        </span>
                        <span className={styles.breadcrumbSep}>/</span>
                        <span className={styles.breadcrumbLink} onClick={() => navigate(`/main/patients/${id}`)}>
                            {patient?.name}
                        </span>
                        <span className={styles.breadcrumbSep}>/</span>
                        <span>{t('patient_files.breadcrumb_current')}</span>
                    </div>
                    <h2 className={styles.pageTitle}>
                        {t('patient_files.title')}
                    </h2>
                </div>
                <div className={styles.patientBadge}>
                    <img src={patient?.avatar || '/default_avatar.svg'} alt="" className={styles.patientAvatar} />
                    <div>
                        <div className={styles.patientName}>{patient?.name}</div>
                        <div className={styles.patientMeta}>
                            {files.length} {t('patient_files.files_count')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Фільтри */}
            <div className={styles.filters}>
                <button
                    className={`${styles.filterBtn} ${filter === 'all' ? styles.filterActive : ''}`}
                    onClick={() => setFilter('all')}
                >
                    {t('patient_files.filter_all')} ({files.length})
                </button>
                {Object.keys(FILE_TYPE_COLORS).map((key) => {
                    const labelData = getFileTypeLabel(key);
                    return counts[key] ? (
                        <button
                            key={key}
                            className={`${styles.filterBtn} ${filter === key ? styles.filterActive : ''}`}
                            onClick={() => setFilter(key)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                            {labelData.icon}
                            <span>{labelData.text} ({counts[key]})</span>
                        </button>
                    ) : null;
                })}
            </div>

            {/* Файли */}
            {filtered.length === 0 ? (
                <div className={styles.empty}>
                    <div className={styles.emptyIcon}>
                        <FaFolderOpen size={40} color="#b0bec5" />
                    </div>
                    <div>{t('patient_files.empty')}</div>
                </div>
            ) : (
                <div className={styles.grid}>
                    {filtered.map(f => {
                        const labelData = getFileTypeLabel(f.file_type);
                        return (
                            <a
                                key={f.file_id}
                                href={f.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.fileCard}
                                style={{ background: FILE_TYPE_COLORS[f.file_type] || '#f5f5f5' }}
                            >
                                <div className={styles.fileCardType} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {labelData.icon}
                                    <span>{labelData.text}</span>
                                </div>
                                <div className={styles.fileCardName}>{f.file_name}</div>
                                <div className={styles.fileCardMeta}>
                                    <span>{f.diagnosis}</span>
                                    <span>{formatDate(f.uploaded_at, i18n.language)}</span>
                                </div>
                                <div className={styles.fileCardOpen}>
                                    <FaExternalLinkAlt size={11} /> {t('patient_files.open')}
                                </div>
                            </a>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default PatientFilesPage;