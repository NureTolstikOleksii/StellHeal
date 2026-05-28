import React, { useState } from 'react';
import styles from '../StaffPage.module.css';
import defaultAvatar from '../../../assets/icons/default_avatar.svg';
import StaffProfileModal from '../modals/StaffProfileModal/StaffProfileModal.jsx';
import { useTranslation } from 'react-i18next';
import { FaBan } from 'react-icons/fa';

const StaffTable = ({ staffList, onEditStaff, onDeleteStaff, onBlockStaff }) => {
    const { t, i18n } = useTranslation();
    const [viewStaff, setViewStaff] = useState(null);

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString(
            i18n.language === 'uk' ? 'uk-UA' : 'en-US',
            { day: '2-digit', month: 'short', year: 'numeric' }
        );
    };

    return (
        <>
            <div className={styles.tableWrapper}>
                {staffList.length === 0 ? (
                    <div className={styles.noData}>
                        <p>{t('staff.no_data')}</p>
                    </div>
                ) : (
                    <table className={styles.staffTable}>
                        <thead>
                        <tr>
                            <th>{t('staff.table.user')}</th>
                            <th>{t('staff.table.phone')}</th>
                            <th>{t('staff.table.email')}</th>
                            <th>{t('staff.table.role')}</th>
                            <th>{t('staff.table.admission_date') || 'Дата прийому'}</th>
                        </tr>
                        </thead>
                        <tbody>
                        {staffList.map(user => {
                            const isBlocked = !!user.lock_until && new Date(user.lock_until) > new Date();
                            return (
                                <tr
                                    key={user.user_id}
                                    className={`${styles.clickableRow} ${isBlocked ? styles.rowBlocked : ''}`}
                                    onClick={() => setViewStaff(user)}
                                >
                                    <td>
                                        <div className={styles.userCell}>
                                            <div className={styles.avatarWrap}>
                                                <img
                                                    src={user.avatar || defaultAvatar}
                                                    alt="avatar"
                                                    className={styles.avatarSmall}
                                                />
                                                {isBlocked && (
                                                    <div className={styles.blockedDot}>
                                                        <FaBan size={7} />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                    <span className={styles.userName}>
                                                        {user.last_name} {user.first_name} {user.patronymic}
                                                    </span>
                                                {isBlocked && (
                                                    <span className={styles.blockedLabel}>
                                                            {t('staff.actions.blocked') || 'Заблоковано'}
                                                        </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td>{user.phone || '—'}</td>
                                    <td>{user.login}</td>
                                    <td>
                                            <span className={styles.roleBadge}>
                                                {user.role_id === 1 ? t('staff.roles.doctor') : t('staff.roles.staff')}
                                            </span>
                                        {user.medical_staff?.specialization && (
                                            <span className={styles.specialization}>
                                                    {' · '}{user.medical_staff.specialization}
                                                </span>
                                        )}
                                    </td>
                                    <td className={styles.dateCell}>
                                        {formatDate(user.medical_staff?.admission_date)}
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                )}
            </div>

            {viewStaff && (
                <StaffProfileModal
                    staff={viewStaff}
                    onClose={() => setViewStaff(null)}
                    onEdit={() => { setViewStaff(null); onEditStaff(viewStaff); }}
                    onDelete={() => { setViewStaff(null); onDeleteStaff(viewStaff.user_id); }}
                    onBlock={() => {
                        const isBlocked = !!viewStaff.lock_until && new Date(viewStaff.lock_until) > new Date();
                        onBlockStaff(viewStaff.user_id, isBlocked);
                        setViewStaff(null);
                    }}
                />
            )}
        </>
    );
};

export default StaffTable;