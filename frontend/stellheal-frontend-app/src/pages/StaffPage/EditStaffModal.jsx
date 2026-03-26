import React, { useState, useEffect } from 'react';
import styles from './AddStaffModal.module.css';
import MuiDatePicker from '../../components/DatePicker/MuiDatePicker';
import { useTranslation } from 'react-i18next';

function toLocalYYYYMMDD(date) {
    if (!date) return null;
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const EditStaffModal = ({ onClose, onSave, staffData }) => {
    const { t } = useTranslation();

    const [formData, setFormData] = useState({
        last_name: '',
        first_name: '',
        patronymic: '',
        login: '',
        phone: '',
        specialization: '',
        shift: '',
        date_of_birth: null,
        role: '',
        contact_info: '',
    });

    const [error, setError] = useState(false);
    const [backendError, setBackendError] = useState('');

    useEffect(() => {
        if (staffData) {
            setFormData({
                last_name: staffData.last_name || '',
                first_name: staffData.first_name || '',
                patronymic: staffData.patronymic || '',
                login: staffData.login || '',
                phone: staffData.phone || '',
                specialization: staffData.medical_staff?.specialization || '',
                shift: staffData.medical_staff?.shift || '',
                date_of_birth: staffData.date_of_birth ? new Date(staffData.date_of_birth) : null,
                role: staffData.roles?.role_name || '',
                contact_info: staffData.contact_info || '',
            });
        }
    }, [staffData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (error) setError(false);
        if (backendError) setBackendError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const requiredFields = [
            'last_name',
            'first_name',
            'login',
            'phone',
            'role',
            'shift',
            'specialization',
            'contact_info',
            'date_of_birth'
        ];

        const hasEmpty = requiredFields.some((field) => {
            return !formData[field] || (typeof formData[field] === 'string' && formData[field].trim() === '');
        });

        if (hasEmpty) {
            setError(true);
            setBackendError('');
            return;
        }

        setError(false);
        setBackendError('');

        const roleMap = {
            doctor: 1,
            nurse: 2,
        };

        const payload = {
            ...formData,
            date_of_birth: toLocalYYYYMMDD(formData.date_of_birth),
            role_id: roleMap[formData.role],
            user_id: staffData.user_id,
        };

        delete payload.role;

        try {
            await onSave(payload);
        } catch (err) {
            const message =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                t('staff.update_error');
            setBackendError(message);
        }
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <h3 className={styles.modalTitle}>{t('staff.edit_title')}</h3>
                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.row}>
                        <input name="last_name" placeholder={t('staff.last_name')} value={formData.last_name} onChange={handleChange} />
                        <input name="first_name" placeholder={t('staff.first_name')} value={formData.first_name} onChange={handleChange} />
                        <input name="patronymic" placeholder={t('staff.patronymic')} value={formData.patronymic} onChange={handleChange} />
                    </div>
                    <div className={styles.row}>
                        <MuiDatePicker
                            value={formData.date_of_birth}
                            onChange={(date) => setFormData((prev) => ({ ...prev, date_of_birth: date }))}
                            label={t('staff.date_of_birth')}
                        />
                        <input name="phone" placeholder={t('staff.phone')} value={formData.phone} onChange={handleChange} />
                        <input name="login" placeholder={t('staff.email')} type="text" value={formData.login} onChange={handleChange} />
                    </div>
                    <div className={styles.row}>
                        <select name="role" value={formData.role} onChange={handleChange}>
                            <option value="">{t('staff.role')}</option>
                            <option value="doctor">{t('staff.doctor')}</option>
                            <option value="nurse">{t('staff.nurse')}</option>
                        </select>
                        <input name="specialization" placeholder={t('staff.specialization')} value={formData.specialization} onChange={handleChange} />
                        <select name="shift" value={formData.shift} onChange={handleChange}>
                            <option value="">{t('staff.shift')}</option>
                            <option value="Денна">{t('staff.shift_day')}</option>
                            <option value="Нічна">{t('staff.shift_night')}</option>
                        </select>
                    </div>
                    <div className={styles.row}>
                        <input name="contact_info" placeholder={t('staff.address')} value={formData.contact_info} onChange={handleChange} />
                    </div>

                    {(error || backendError) && (
                        <div className={styles.errorMessage}>
                            {error && <div>{t('staff.fill_all_fields')}</div>}
                            {backendError && <div>{backendError}</div>}
                        </div>
                    )}

                    <div className={styles.buttons}>
                        <button type="submit" className={styles.submitButton}>{t('staff.update')}</button>
                        <button type="button" className={styles.cancelButton} onClick={onClose}>{t('staff.close')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditStaffModal;
