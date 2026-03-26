import React from 'react';
import styles from './StaffPage.module.css';
import { useTranslation } from 'react-i18next';

const StaffFilters = ({ filters, updateFilters, setFilters, counts }) => {
    const { t } = useTranslation();

    return (
        <aside className={styles.filters}>
            <h3>{t('staff.filters.title')}</h3>

            {/* Фільтр за посадою */}
            <div className={styles.filterGroup}>
                <p className={styles.filterLabel}>{t('staff.filters.role')}</p>
                <label>
                    <input
                        type="checkbox"
                        checked={filters.roles.includes('doctor')}
                        onChange={() => updateFilters('roles', 'doctor')}
                    /> {t('staff.roles.doctor')} ({counts.roles.doctor})
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={filters.roles.includes('staff')}
                        onChange={() => updateFilters('roles', 'staff')}
                    /> {t('staff.roles.staff')} ({counts.roles.staff})
                </label>
            </div>

            {/* Фільтр за датою працевлаштування */}
            <div className={styles.filterGroup}>
                <p className={styles.filterLabel}>{t('staff.filters.employment_date')}</p>
                <label>
                    <input
                        type="checkbox"
                        checked={filters.employmentDates.includes('month')}
                        onChange={() => updateFilters('employmentDates', 'month')}
                    /> {t('staff.filters.last_month')} ({counts.employmentDates.month})
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={filters.employmentDates.includes('year')}
                        onChange={() => updateFilters('employmentDates', 'year')}
                    /> {t('staff.filters.last_year')} ({counts.employmentDates.year})
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={filters.employmentDates.includes('decade')}
                        onChange={() => updateFilters('employmentDates', 'decade')}
                    /> {t('staff.filters.last_decade')} ({counts.employmentDates.decade})
                </label>
            </div>

            {/* Фільтр за зміною */}
            <div className={styles.filterGroup}>
                <p className={styles.filterLabel}>{t('staff.filters.shift')}</p>
                <label>
                    <input
                        type="checkbox"
                        checked={filters.shifts.includes('Денна')}
                        onChange={() => updateFilters('shifts', 'Денна')}
                    /> {t('staff.filters.day')} ({counts.shifts['Денна']})
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={filters.shifts.includes('Нічна')}
                        onChange={() => updateFilters('shifts', 'Нічна')}
                    /> {t('staff.filters.night')} ({counts.shifts['Нічна']})
                </label>
            </div>

            <button
                className={styles.clearButton}
                onClick={() => setFilters({ roles: [], shifts: [], employmentDates: [] })}
            >
                {t('staff.filters.clear')}
            </button>
        </aside>
    );
};

export default StaffFilters;
