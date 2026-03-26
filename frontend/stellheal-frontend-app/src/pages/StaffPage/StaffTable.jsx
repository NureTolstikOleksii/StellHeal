import React, { useState } from 'react';
import styles from './StaffPage.module.css';
import defaultAvatar from '../../assets/default_avatar.svg';
import StaffActionsPopup from './StaffActionsPopup';
import { useTranslation } from 'react-i18next';

const StaffTable = ({ staffList, onEditStaff, onDeleteStaff }) => {
    const { t } = useTranslation();
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [, setPopupPosition] = useState({ x: 0, y: 0 });

    const handleMoreClick = (e, userId) => {
        e.stopPropagation();
        const rect = e.target.getBoundingClientRect();
        setPopupPosition({ x: rect.right, y: rect.bottom });
        setSelectedUserId(userId);
    };

    const closePopup = () => setSelectedUserId(null);

    return (
        <div className={styles.tableWrapper}>
            {staffList.length === 0 ? (
                <p className={styles.noDataText}>{t('staff.no_data')}</p>
            ) : (
                <table className={styles.staffTable}>
                    <thead>
                    <tr>
                        <th>{t('staff.table.user')}</th>
                        <th>{t('staff.table.phone')}</th>
                        <th>{t('staff.table.email')}</th>
                        <th>{t('staff.table.role')}</th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody>
                    {staffList.map((user) => (
                        <tr key={user.user_id}>
                            <td className={styles.userCell}>
                                <img
                                    src={user.avatar || defaultAvatar}
                                    alt="avatar"
                                    className={styles.avatarSmall}
                                />
                                <span>{user.last_name} {user.first_name} {user.patronymic}</span>
                            </td>
                            <td>{user.phone || '-'}</td>
                            <td>{user.login}</td>
                            <td>
                                {user.role_id === 1
                                    ? `${t('staff.roles.doctor')} - ${user.medical_staff?.specialization || ''}`
                                    : `${t('staff.roles.staff')} - ${user.medical_staff?.specialization || ''}`}
                            </td>
                            <td style={{ position: 'relative' }}>
                                <button
                                    className={styles.moreButton}
                                    onClick={(e) => handleMoreClick(e, user.user_id)}
                                >
                                    ⋮
                                </button>
                                {selectedUserId === user.user_id && (
                                    <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 10 }}>
                                        <StaffActionsPopup
                                            onClose={closePopup}
                                            onEdit={() => {
                                                closePopup();
                                                onEditStaff(user);
                                            }}
                                            onDelete={() => {
                                                closePopup();
                                                onDeleteStaff(user.user_id);
                                            }}
                                            onBlock={() => alert(t('staff.block', { id: user.user_id }))}
                                        />
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default StaffTable;
