import React, { useState } from 'react';
import styles from '../PatientDetailsPage.module.css';
import {
    FaBed, FaUserMd, FaClock, FaCheckCircle, FaPaperclip,
    FaTimes, FaSpinner, FaChevronDown, FaChevronUp,
    FaChartBar, FaEdit,
} from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { getPrescriptionFiles } from '../../../services/patientService';
import { useNavigate } from 'react-router-dom';
import LoaderOverlay from "../../../components/LoaderOverlay/LoaderOverlay.jsx";
import { formatDate } from '../../../utils/dateTime';
import i18n from "i18next";

// ── FilesModal ────────────────────────────────────────────────────────────────
const FilesModal = ({ prescriptionId, patientId, onClose }) => {
    const { t } = useTranslation();
    const [files, setFiles]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]   = useState(null);

    React.useEffect(() => {
        getPrescriptionFiles(patientId, prescriptionId)
            .then(setFiles)
            .catch(() => setError(t('files_modal.load_error')))
            .finally(() => setLoading(false));
    }, [prescriptionId, patientId, t]);

    // Мапінг типів файлів через переклад
    const getFileTypeLabel = (type) => {
        const labels = {
            analysis: t('file_types.analysis'),
            xray:     t('file_types.xray'),
            mri:      t('file_types.mri'),
            ecg:      t('file_types.ecg'),
            uzi:      t('file_types.uzi'),
            other:    t('file_types.other'),
        };
        return labels[type] || `📄 ${t('file_types.default_file')}`;
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.filesModal} onClick={e => e.stopPropagation()}>
                <div className={styles.filesModalHeader}>
                    <span className={styles.filesModalTitle}>{t('files_modal.title')}</span>
                    <button className={styles.filesModalClose} onClick={onClose}><FaTimes /></button>
                </div>
                {loading && <LoaderOverlay inline />}
                {error && <div className={styles.filesModalError}>{error}</div>}
                {!loading && !error && files.length === 0 && (
                    <div className={styles.filesModalEmpty}>{t('files_modal.empty')}</div>
                )}
                {!loading && files.map(f => (
                    <a key={f.file_id} href={f.url} target="_blank" rel="noopener noreferrer" className={styles.fileRow}>
                        <span className={styles.fileRowType}>{getFileTypeLabel(f.file_type)}</span>
                        <span className={styles.fileRowName}>{f.file_name}</span>
                        <span className={styles.fileRowDate}>
                            <span className={styles.fileRowDate}>{formatDate(f.uploaded_at, i18n.language)}</span>
                        </span>
                    </a>
                ))}
            </div>
        </div>
    );
};

// ── DetailRow ─────────────────────────────────────────────────────────────────
const DetailRow = ({ label, value }) => {
    if (!value) return null;
    return (
        <div className={styles.detailItem}>
            <span className={styles.detailLabel}>{label}</span>
            <span className={styles.detailValue}>{value}</span>
        </div>
    );
};

// ── DiagnosisCard ─────────────────────────────────────────────────────────────
const DiagnosisCard = ({ diagnosis, isHistory, onDelete, role, patientId }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [showFiles, setShowFiles]     = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    const hasDetails = diagnosis.complaints || diagnosis.anamnesis ||
        diagnosis.objectiveStatus || diagnosis.recommendations || diagnosis.notes;

    const hasActions = !isHistory && (
        diagnosis.filesCount > 0 || role !== 'admin'
    );

    const handleDelete = () => {
        if (window.confirm(t('diagnosis_card.confirm_delete'))) {
            onDelete(diagnosis.prescriptionId);
        }
    };

    const formattedDate    = formatDate(diagnosis.date, i18n.language);
    const formattedDateEnd = formatDate(diagnosis.endDate, i18n.language);

    return (
        <>
            <div className={styles.card}>

                {/* ── Header ── */}
                <div className={styles.cardHeader}>
                    <div className={styles.cardTitleBlock}>
                        <span className={styles.cardTitle}>{diagnosis.name}</span>
                        {diagnosis.icdCode && (
                            <span className={styles.icdBadge}>{diagnosis.icdCode}</span>
                        )}
                        <span className={styles.cardDates}>{formattedDate} — {formattedDateEnd}</span>
                    </div>
                    <div className={styles.actions}>
                        {isHistory ? (
                            <div className={styles.statusDone}>
                                {t('diagnosis_card.completed')} <FaCheckCircle className={styles.statusIcon} />
                            </div>
                        ) : role !== 'admin' && (
                            <button className={styles.deleteBtn} onClick={handleDelete}>
                                {t('diagnosis_card.delete')}
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Medications ── */}
                <div className={styles.medicationsList}>
                    {diagnosis.medications.map((med, index) => (
                        <div key={index} className={styles.medicationItem}>{index + 1}. {med}</div>
                    ))}
                </div>

                {/* ── Footer info ── */}
                <div className={styles.detailsRow}>
                    <span><FaBed /> {t('diagnosis_card.ward')}: {diagnosis.ward}</span>
                    <span><FaUserMd /> {t('diagnosis_card.doctor')}: {diagnosis.doctor}</span>
                    <span><FaClock /> {t('diagnosis_card.duration')}: {diagnosis.duration} {t('diagnosis_card.days')}</span>
                </div>

                {/* ── Expand button ── */}
                {(hasDetails || hasActions) && (
                    <button
                        className={styles.expandBtn}
                        onClick={() => setShowDetails(v => !v)}
                    >
                        {showDetails ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                        {showDetails ? t('diagnosis_card.hide_details') : t('diagnosis_card.show_details')}
                    </button>
                )}

                {/* ── Details panel ── */}
                {showDetails && (
                    <div className={styles.detailsPanel}>

                        {/* Кнопки дій */}
                        {hasActions && (
                            <div className={styles.detailActions}>
                                {diagnosis.filesCount > 0 && (
                                    <button className={styles.filesBtn} onClick={() => setShowFiles(true)}>
                                        <FaPaperclip size={13} /> {t('diagnosis_card.files')} ({diagnosis.filesCount})
                                    </button>
                                )}
                                {!isHistory && role !== 'admin' && (
                                    <button
                                        className={styles.editBtn}
                                        onClick={() => navigate(`/main/patients/${patientId}/prescription/${diagnosis.prescriptionId}/edit`)}
                                    >
                                        <FaEdit size={12} /> {t('diagnosis_card.edit')}
                                    </button>
                                )}
                                {!isHistory && (
                                    <button
                                        className={styles.statsBtn}
                                        onClick={() => navigate(
                                            `/main/patients/${patientId}/intake/${diagnosis.prescriptionId}`,
                                            { state: {
                                                    startDate: diagnosis.date?.substring(0, 10),
                                                    endDate:   diagnosis.endDate?.substring(0, 10)
                                                }}
                                        )}
                                    >
                                        <FaChartBar size={13} /> {t('diagnosis_card.statistics')}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Клінічні деталі */}
                        <DetailRow label={t('diagnosis_card.complaints')} value={diagnosis.complaints} />
                        <DetailRow label={t('diagnosis_card.medical_history')} value={diagnosis.anamnesis} />
                        <DetailRow label={t('diagnosis_card.objective_condition')} value={diagnosis.objectiveStatus} />
                        <DetailRow label={t('diagnosis_card.recommendations')} value={diagnosis.recommendations} />
                        <DetailRow label={t('diagnosis_card.notes')} value={diagnosis.notes} />
                    </div>
                )}
            </div>

            {showFiles && (
                <FilesModal
                    prescriptionId={diagnosis.prescriptionId}
                    patientId={patientId}
                    onClose={() => setShowFiles(false)}
                />
            )}
        </>
    );
};

export default DiagnosisCard;