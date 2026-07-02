import React from 'react';
import styles from '../StaffPage.module.css';
import { useTranslation } from 'react-i18next';
import { FaFilter, FaTimes } from 'react-icons/fa';

const StaffFilters = ({ filters, updateFilters, setFilters, counts }) => {
    const { t } = useTranslation();

    const hasActive = filters.roles.length > 0 || filters.shifts.length > 0 || filters.employmentDates.length > 0;

    const CheckItem = ({ group, value, label, count }) => (
        <label className={styles.checkLabel}>
            <input
                type="checkbox"
                className={styles.checkbox}
                checked={filters[group].includes(value)}
                onChange={() => updateFilters(group, value)}
            />
            <span className={styles.checkText}>{label}</span>
            <span className={styles.checkCount}>{count}</span>
        </label>
    );

    return (
        <aside className={styles.filters}>
            <div className={styles.filtersHeader}>
                <div className={styles.filtersTitleRow}>
                    <FaFilter size={13} className={styles.filtersIcon} />
                    <span className={styles.filtersTitle}>{t('staff.filters.title')}</span>
                </div>
                {hasActive && (
                    <button
                        className={styles.clearBtnSmall}
                        onClick={() => setFilters({ roles: [], shifts: [], employmentDates: [] })}
                    >
                        <FaTimes size={11} />
                    </button>
                )}
            </div>

            <div className={styles.filterGroup}>
                <p className={styles.filterLabel}>{t('staff.filters.role')}</p>
                <CheckItem group="roles" value="doctor" label={t('staff.roles.doctor')} count={counts.roles.doctor} />
                <CheckItem group="roles" value="staff"  label={t('staff.roles.staff')}  count={counts.roles.staff}  />
            </div>

            <div className={styles.filterGroup}>
                <p className={styles.filterLabel}>{t('staff.filters.employment_date')}</p>
                <CheckItem group="employmentDates" value="month"  label={t('staff.filters.last_month')}  count={counts.employmentDates.month}  />
                <CheckItem group="employmentDates" value="year"   label={t('staff.filters.last_year')}   count={counts.employmentDates.year}   />
                <CheckItem group="employmentDates" value="decade" label={t('staff.filters.last_decade')} count={counts.employmentDates.decade} />
            </div>

            <div className={styles.filterGroup}>
                <p className={styles.filterLabel}>{t('staff.filters.shift')}</p>
                <CheckItem group="shifts" value="Денна" label={t('staff.filters.day')}   count={counts.shifts['Денна']} />
                <CheckItem group="shifts" value="Нічна" label={t('staff.filters.night')} count={counts.shifts['Нічна']} />
            </div>

            {hasActive && (
                <button
                    className={styles.clearButton}
                    onClick={() => setFilters({ roles: [], shifts: [], employmentDates: [] })}
                >
                    {t('staff.filters.clear')}
                </button>
            )}
        </aside>
    );
};

export default StaffFilters;