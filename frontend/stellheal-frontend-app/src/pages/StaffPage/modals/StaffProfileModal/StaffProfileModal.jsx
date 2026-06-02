import React from 'react';
import styles from './StaffProfileModal.module.css';
import defaultAvatar from '../../../../assets/icons/default_avatar.svg';
import { useTranslation } from 'react-i18next';
import {
    FaTimes, FaUserEdit, FaBan, FaTrashAlt,
    FaPhone, FaEnvelope, FaMapMarkerAlt,
    FaClock, FaCalendarAlt, FaCheckCircle,
} from 'react-icons/fa';

// Імпортуємо обидві функції з вашого dateTime.js
import { formatDateLong } from '../../../../utils/dateTime';

const StaffProfileModal = ({ staff, onClose, onEdit, onDelete, onBlock }) => {
    const { t, i18n } = useTranslation();

    const isBlocked = !!staff.lock_until && new Date(staff.lock_until) > new Date();

    const InfoRow = ({ icon: Icon, label, value }) => {
        if (!value || value === '—') return null;
        return (
            <div className={styles.infoRow}>
                <div className={styles.infoIcon}><Icon size={14} /></div>
                <div>
                    <div className={styles.infoLabel}>{label}</div>
                    <div className={styles.infoValue}>{value}</div>
                </div>
            </div>
        );
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>

                {/* Close */}
                <button className={styles.closeBtn} onClick={onClose}>
                    <FaTimes size={15} />
                </button>

                {/* Avatar + name */}
                <div className={styles.top}>
                    <div className={styles.avatarWrap}>
                        <img
                            src={staff.avatar || defaultAvatar}
                            alt="avatar"
                            className={styles.avatar}
                        />
                        {isBlocked && (
                            <div className={styles.blockedOverlay}>
                                <FaBan size={18} />
                            </div>
                        )}
                    </div>
                    <div className={styles.nameBlock}>
                        <h3 className={styles.name}>
                            {staff.last_name} {staff.first_name} {staff.patronymic}
                        </h3>
                        <div className={styles.badges}>
                            <span className={styles.roleBadge}>
                                {staff.role_id === 1 ? t('staff.roles.doctor') : t('staff.roles.staff')}
                            </span>
                            {isBlocked && (
                                <span className={styles.blockedBadge}>
                                    <FaBan size={10} /> {t('staff.actions.blocked') || 'Заблоковано'}
                                </span>
                            )}
                        </div>
                        {staff.medical_staff?.specialization && (
                            <p className={styles.specialization}>{staff.medical_staff.specialization}</p>
                        )}
                    </div>
                </div>

                <div className={styles.divider} />

                {/* Info */}
                <div className={styles.infoGrid}>
                    <InfoRow icon={FaPhone}        label={t('staff.phone')}   value={staff.phone} />
                    <InfoRow icon={FaEnvelope}     label={t('staff.email')}   value={staff.login} />
                    <InfoRow icon={FaMapMarkerAlt} label={t('staff.address')} value={staff.contact_info} />
                    <InfoRow icon={FaClock}        label={t('staff.shift')}   value={staff.medical_staff?.shift} />
                    <InfoRow
                        icon={FaCalendarAlt}
                        label={t('staff.table.admission_date') || 'Дата прийому'}
                        // Використовуємо довгу локалізовану функцію з утілс
                        value={formatDateLong(staff.medical_staff?.admission_date, i18n.language)}
                    />
                    <InfoRow
                        icon={FaCalendarAlt}
                        label={t('patient_form.birth_date')}
                        // Використовуємо коротку локалізовану функцію з утілс ("dd.mm.yyyy")
                        value={formatDateLong(staff.date_of_birth, i18n.language)}
                    />
                </div>

                <div className={styles.divider} />

                {/* Actions */}
                <div className={styles.actions}>
                    <div className={styles.topActions}>
                        <button className={styles.editBtn} onClick={onEdit}>
                            <FaUserEdit size={13} /> {t('staff.actions.edit')}
                        </button>
                        <button
                            className={`${styles.blockBtn} ${isBlocked ? styles.unblockBtn : ''}`}
                            onClick={onBlock}
                        >
                            {isBlocked
                                ? <><FaCheckCircle size={13} /> {t('staff.actions.unblock') || 'Розблокувати'}</>
                                : <><FaBan size={13} /> {t('staff.actions.block') || 'Заблокувати'}</>
                            }
                        </button>
                    </div>
                    <button className={styles.deleteBtn} onClick={onDelete}>
                        <FaTrashAlt size={13} /> {t('staff.actions.delete')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StaffProfileModal;