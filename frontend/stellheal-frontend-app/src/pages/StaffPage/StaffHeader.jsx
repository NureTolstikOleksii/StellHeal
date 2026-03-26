import React from 'react';
import styles from './StaffPage.module.css';
import { FaUserPlus, FaShieldAlt, FaFileExport } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const StaffHeader = ({ onAddClick, staffCount, onOpenRoles, onExport }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.header}>
            <div className={styles.titleBlock}>
                <h2 className={styles.pageTitle}>{t('staff.title')}</h2>
                <div className={styles.countItem}>
                    <div className={styles.countValue}>{staffCount}</div>
                    <div className={styles.countLabel}>{t('staff.count')}</div>
                </div>
            </div>
            <div className={styles.actions}>
                <button className={styles.addButton} onClick={onAddClick}>
                    <FaUserPlus className={styles.icon} />
                    {t('staff.add')}
                </button>
                <button className={styles.rolesButton} onClick={onOpenRoles}>
                    <FaShieldAlt className={styles.icon} />
                    {t('staff.configure_roles')}
                </button>
                <button className={styles.exportButton} onClick={onExport}>
                    <FaFileExport className={styles.icon} />
                    {t('staff.export')}
                </button>
            </div>
        </div>
    );
};

export default StaffHeader;
