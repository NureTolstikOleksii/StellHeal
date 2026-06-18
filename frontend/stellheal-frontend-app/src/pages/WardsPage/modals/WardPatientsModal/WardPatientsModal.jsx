import React, { useEffect, useState } from 'react';
import styles from './WardPatientsModal.module.css';
import {
    FaTimes, FaUserInjured,
    FaUserMd, FaCalendarAlt, FaNotesMedical,
    FaBan, FaLock, FaLockOpen,
} from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { getWardPatients, blockWard, unblockWard } from '../../../../services/wardsService.js';
import LoaderOverlay from '../../../../components/LoaderOverlay/LoaderOverlay.jsx';
import defaultAvatar from '../../../../assets/icons/default_avatar.svg';
import { formatDate } from '../../../../utils/dateTime';

const WardPatientsModal = ({ ward: initialWard, onClose, onBlockToggle }) => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language || 'uk';

    const [ward, setWard]         = useState(initialWard);
    const [patients, setPatients] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [blocking, setBlocking] = useState(false);

    useEffect(() => {
        getWardPatients(ward.ward_id)
            .then(res => setPatients(res.data || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [ward.ward_id]);

    const handleBlockToggle = async () => {
        setBlocking(true);
        try {
            if (ward.is_blocked) {
                await unblockWard(ward.ward_id);
            } else {
                await blockWard(ward.ward_id);
            }
            onBlockToggle?.();
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setBlocking(false);
        }
    };

    const daysLeft = (endDate) => {
        if (!endDate) return null;
        return Math.ceil((new Date(endDate) - new Date()) / 86400000);
    };

    const occupancy = ward.capacity
        ? Math.round((ward.active_patients / ward.capacity) * 100)
        : 0;
    const barColor = occupancy >= 100 ? '#ef4444' : occupancy >= 75 ? '#f59e0b' : '#22c55e';

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>

                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div>
                            <div className={styles.titleRow}>
                                <h3 className={styles.title}>
                                    {t('wards.ward')} <span className={styles.wardNum}>{ward.ward_number}</span>
                                </h3>
                                {ward.is_blocked && (
                                    <span className={styles.blockedBadge}>
                                        <FaBan size={11} /> {t('wards.blocked') || 'Заблоковано'}
                                    </span>
                                )}
                            </div>
                            <div className={styles.capacity}>
                                {ward.active_patients} / {ward.capacity ?? '—'} {t('wards.beds') || 'місць'}
                            </div>
                        </div>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <FaTimes size={15} />
                    </button>
                </div>

                {ward.capacity > 0 && (
                    <div className={styles.occupancyWrap}>
                        <div className={styles.occupancyBar}>
                            <div
                                className={styles.occupancyFill}
                                style={{ width: `${Math.min(occupancy, 100)}%`, background: barColor }}
                            />
                        </div>
                        <span className={styles.occupancyLabel}>{occupancy}%</span>
                    </div>
                )}

                <button
                    className={`${styles.blockBtn} ${ward.is_blocked ? styles.unblockBtn : ''}`}
                    onClick={handleBlockToggle}
                    disabled={blocking}
                >
                    {ward.is_blocked
                        ? <><FaLockOpen size={13} /> {t('wards.unblock') || 'Розблокувати палату'}</>
                        : <><FaLock size={13} /> {t('wards.block') || 'Заблокувати палату'}</>
                    }
                </button>

                {ward.is_blocked && (
                    <div className={styles.blockedWarning}>
                        <FaBan size={13} className={styles.blockedWarningIcon} />
                        <span>{t('wards.blocked_hint') || 'Палата заблокована — лікарі не можуть призначати її пацієнтам'}</span>
                    </div>
                )}

                <div className={styles.divider} />

                {loading ? (
                    <div className={styles.loaderWrap}><LoaderOverlay inline /></div>
                ) : patients.length === 0 ? (
                    <div className={styles.empty}>
                        <FaUserInjured size={32} color="#d1d5db" />
                        <p>{t('wards.no_patients') || 'В палаті немає активних пацієнтів'}</p>
                    </div>
                ) : (
                    <div className={styles.patientsList}>
                        {patients.map(p => {
                            const days = daysLeft(p.end_date);
                            return (
                                <div key={p.prescription_id} className={styles.patientCard}>
                                    <img
                                        src={p.patient_avatar || defaultAvatar}
                                        alt=""
                                        className={styles.avatar}
                                    />
                                    <div className={styles.patientInfo}>
                                        <div className={styles.patientName}>
                                            {p.patient_last_name} {p.patient_first_name} {p.patient_patronymic}
                                        </div>
                                        {p.diagnosis && (
                                            <div className={styles.diagnosis}>
                                                <FaNotesMedical size={11} className={styles.diagIcon} />
                                                {p.icd_code && (
                                                    <span className={styles.icdCode}>
                                                        {p.icd_code.split('—')[0].trim()}
                                                    </span>
                                                )}
                                                <span>{p.diagnosis}</span>
                                            </div>
                                        )}
                                        <div className={styles.meta}>
                                            {p.doctor_name && (
                                                <span className={styles.metaItem}>
                                                    <FaUserMd size={11} /> {p.doctor_name}
                                                </span>
                                            )}
                                            {p.end_date && (
                                                <span className={`${styles.metaItem} ${days !== null && days <= 3 ? styles.metaUrgent : ''}`}>
                                                    <FaCalendarAlt size={11} />
                                                    {t('wards.until') || 'До'} {formatDate(p.end_date, lang)}
                                                    {days !== null && days >= 0 && (
                                                        <span className={styles.daysLeft}>
                                                            ({days} {t('wards.days') || 'дн.'})
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WardPatientsModal;