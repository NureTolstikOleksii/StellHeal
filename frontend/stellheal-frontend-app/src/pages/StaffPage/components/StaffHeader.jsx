import React from 'react';
import styles from '../StaffPage.module.css';
import { FaUserPlus, FaShieldAlt, FaFileExport, FaUsers } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const StaffHeader = ({ onAddClick, staffCount, onOpenRoles, onExport }) => {
    const { t } = useTranslation();

    return (
        <div className={styles.header}>
            <div className={styles.titleBlock}>
                <div className={styles.pageTitleRow}>
                    {/*<FaUsers className={styles.pageTitleIcon} />*/}
                    <h2 className={styles.pageTitle}>{t('staff.title')}</h2>
                </div>
                <div className={styles.counts}>
                    <div className={styles.countItem}>
                        <div className={styles.countValue}>{staffCount}</div>
                        <div className={styles.countLabel}>{t('staff.count')}</div>
                    </div>
                </div>
            </div>

            <div className={styles.actions}>
                <button className={styles.addButton} onClick={onAddClick}>
                    <FaUserPlus size={14} /> {t('staff.add')}
                </button>
                <button className={styles.exportButton} onClick={onExport}>
                    <FaFileExport size={14} /> {t('staff.export')}
                </button>
            </div>
        </div>
    );
};

export default StaffHeader;