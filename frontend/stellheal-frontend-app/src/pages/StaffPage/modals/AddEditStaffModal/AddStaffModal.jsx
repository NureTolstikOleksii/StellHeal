import React, { useState } from 'react';
import styles from './AddStaffModal.module.css';
import MuiDatePicker from '../../../../components/DatePicker/MuiDatePicker.jsx';
import { useTranslation } from 'react-i18next';
import { FaUserPlus, FaTimes, FaUserMd } from 'react-icons/fa';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toLocalYYYYMMDD(date) {
    if (!date) return null;
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const ROLE_MAP = { doctor: 1, nurse: 2 };

// ✅ 1. ВИНОСИМО КОМПОНЕНТ "F" НАВЕРХ І ПЕРЕДАЄМО НЕОБХІДНІ ДАНІ ЧЕРЕЗ ПРОПСИ
const F = ({ name, label, placeholder, type = 'text', formData, errors, handleChange }) => (
    <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>{label}</label>
        <input
            type={type}
            name={name}
            value={formData[name]}
            onChange={handleChange}
            placeholder={placeholder || label}
            className={`${styles.input} ${errors[name] ? styles.inputError : ''}`}
            autoComplete="off"
        />
        {errors[name] && <span className={styles.fieldError}>{errors[name]}</span>}
    </div>
);

const AddStaffModal = ({ onClose, onSave }) => {
    const { t, i18n } = useTranslation();
    const phonePlaceholder = i18n.language === 'uk' ? '+38 (0...)...' : '+1 (___) ___-____';

    const [formData, setFormData] = useState({
        last_name: '', first_name: '', patronymic: '',
        login: '', phone: '', specialization: '',
        shift: '', date_of_birth: null, role: '', contact_info: '',
    });
    const [errors, setErrors]           = useState({});
    const [serverError, setServerError] = useState('');
    const [saving, setSaving]           = useState(false);

    const validate = () => {
        const e = {};
        if (!formData.last_name.trim())   e.last_name   = t('profile.required');
        if (!formData.first_name.trim())  e.first_name  = t('profile.required');
        if (!formData.patronymic.trim())  e.patronymic  = t('profile.required');
        if (!formData.phone.trim())       e.phone       = t('profile.required');
        if (!formData.contact_info.trim()) e.contact_info = t('profile.required');
        if (!formData.specialization.trim()) e.specialization = t('profile.required');
        if (!formData.role)               e.role        = t('profile.required');
        if (!formData.shift)              e.shift       = t('profile.required');
        if (!formData.date_of_birth)      e.date_of_birth = t('profile.required');
        if (!formData.login.trim())       e.login       = t('profile.required');
        else if (!EMAIL_RE.test(formData.login)) e.login = t('patient_form.errors.invalid_email');
        return e;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setErrors(p => { const u = { ...p }; delete u[name]; return u; });
        setServerError('');
        setFormData(p => ({ ...p, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }

        setSaving(true);
        try {
            const payload = {
                ...formData,
                date_of_birth: toLocalYYYYMMDD(formData.date_of_birth),
                role_id: ROLE_MAP[formData.role],
            };
            delete payload.role;
            await onSave(payload);
        } catch (err) {
            setServerError(err?.response?.data?.message || err?.response?.data?.error || t('staff.add_generic_error'));
        } finally {
            setSaving(false);
        }
    };

    // ✅ 2. СТВОРЮЄМО ЗРУЧНИЙ ХЕЛПЕР ДЛЯ СКОРОЧЕННЯ ЗАПИСУ (не створює новий компонент)
    const renderField = (name, label, placeholder, type) => (
        <F
            name={name}
            label={label}
            placeholder={placeholder}
            type={type}
            formData={formData}
            errors={errors}
            handleChange={handleChange}
        />
    );

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>

                <div className={styles.modalHeader}>
                    <div className={styles.modalTitleRow}>
                        <FaUserPlus className={styles.modalTitleIcon} />
                        <h3 className={styles.title}>{t('staff.add_title')}</h3>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}><FaTimes size={15} /></button>
                </div>

                <form onSubmit={handleSubmit} noValidate className={styles.form}>

                    {/* ПІБ */}
                    <p className={styles.sectionLabel}>Особисті дані</p>
                    <div className={styles.row}>
                        {renderField("last_name", t('staff.last_name'))}
                        {renderField("first_name", t('staff.first_name'))}
                        {renderField("patronymic", t('staff.patronymic'))}
                    </div>

                    {/* Дата, телефон, email */}
                    <div className={styles.row}>
                        <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel}>{t('patient_form.birth_date')}</label>
                            <MuiDatePicker
                                value={formData.date_of_birth}
                                onChange={date => { setFormData(p => ({ ...p, date_of_birth: date })); setErrors(p => { const u = { ...p }; delete u.date_of_birth; return u; }); }}
                                error={!!errors.date_of_birth}
                            />
                            {errors.date_of_birth && <span className={styles.fieldError}>{errors.date_of_birth}</span>}
                        </div>
                        {renderField("phone", t('staff.phone'), phonePlaceholder)}
                        {renderField("login", t('staff.email'), "example@email.com")}
                    </div>

                    {/* Адреса */}
                    <div className={styles.fieldGroupFull}>
                        <label className={styles.fieldLabel}>{t('staff.address')}</label>
                        <input
                            name="contact_info"
                            value={formData.contact_info}
                            onChange={handleChange}
                            placeholder={t('staff.address')}
                            className={`${styles.input} ${errors.contact_info ? styles.inputError : ''}`}
                        />
                        {errors.contact_info && <span className={styles.fieldError}>{errors.contact_info}</span>}
                    </div>

                    {/* Роль, спеціалізація, зміна */}
                    <p className={styles.sectionLabel}>Робочі дані</p>
                    <div className={styles.row}>
                        <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel}>{t('staff.role')}</label>
                            <select name="role" value={formData.role} onChange={handleChange} className={`${styles.select} ${errors.role ? styles.inputError : ''}`}>
                                <option value="">{t('staff.role')}...</option>
                                <option value="doctor">{t('staff.doctor')}</option>
                                <option value="nurse">{t('staff.nurse')}</option>
                            </select>
                            {errors.role && <span className={styles.fieldError}>{errors.role}</span>}
                        </div>
                        {renderField("specialization", t('staff.specialization'))}
                        <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel}>{t('staff.shift')}</label>
                            <select name="shift" value={formData.shift} onChange={handleChange} className={`${styles.select} ${errors.shift ? styles.inputError : ''}`}>
                                <option value="">{t('staff.shift')}...</option>
                                <option value="Денна">{t('staff.shift_day')}</option>
                                <option value="Нічна">{t('staff.shift_night')}</option>
                            </select>
                            {errors.shift && <span className={styles.fieldError}>{errors.shift}</span>}
                        </div>
                    </div>

                    {serverError && <div className={styles.errorMsg}>{serverError}</div>}

                    <div className={styles.actions}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>{t('common.cancel')}</button>
                        <button type="submit" className={styles.submitBtn} disabled={saving}>
                            <FaUserMd size={13} />
                            {saving ? '...' : t('staff.confirm')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddStaffModal;