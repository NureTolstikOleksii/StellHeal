import React from 'react';
import styles from './StaffActionsPopup.module.css';
import { useTranslation } from 'react-i18next';

const StaffActionsPopup = ({ onClose, onEdit, onDelete }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.popup}>
            <button className={styles.close} onClick={onClose}>
                ✕
            </button>
            <button className={styles.item} onClick={onEdit}>
                {t('staff.actions.edit')}
            </button>
            <button className={`${styles.item} ${styles.delete}`} onClick={onDelete}>
                {t('staff.actions.delete')}
            </button>
        </div>
    );
};

export default StaffActionsPopup;
