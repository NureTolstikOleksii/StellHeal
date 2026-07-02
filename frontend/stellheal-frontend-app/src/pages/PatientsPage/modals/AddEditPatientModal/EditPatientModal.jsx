import React, { useState } from 'react';
import styles from './AddPatientModal.module.css';
import { useTranslation } from 'react-i18next';
import { FaUserEdit, FaTimes } from 'react-icons/fa';
import MuiDatePicker from '../../../../components/DatePicker/MuiDatePicker.jsx';
import { updatePatient } from '../../../../services/patientService.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toLocalYYYYMMDD = (date) => {
    if (!date) return null;
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
};

const EditPatientModal = ({ onClose, patient, setPatient }) => {
    const { t, i18n } = useTranslation();
    const phonePlaceholder = i18n.language === 'uk' ? '+38 (0...)...' : '+1 (___) ___-____';

    const [formData, setFormData] = useState({
        last_name:    patient.last_name   || patient.name?.split(' ')[0] || '',
        first_name:   patient.first_name  || patient.name?.split(' ')[1] || '',
        patronymic:   patient.patronymic  || patient.name?.split(' ')[2] || '',
        email:        patient.login       || patient.email || '',
        phone:        patient.phone       || '',
        contact_info: patient.address     || '',
        birth_date: parseDate(patient.dob),
    });
    const [errors, setErrors]       = useState({});
    const [formError, setFormError] = useState('');
    const [loading, setLoading]     = useState(false);

    const validate = () => {
        const e = {};
        if (!formData.last_name.trim())    e.last_name    = t('profile.required');
        if (!formData.first_name.trim())   e.first_name   = t('profile.required');
        if (!formData.patronymic.trim())   e.patronymic   = t('profile.required');
        if (!formData.phone.trim())        e.phone        = t('profile.required');
        if (!formData.contact_info.trim()) e.contact_info = t('profile.required');
        if (!formData.birth_date)          e.birth_date   = t('profile.required');
        if (!formData.email.trim())        e.email        = t('profile.required');
        else if (!EMAIL_RE.test(formData.email)) e.email  = t('patient_form.errors.invalid_email');
        return e;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setErrors(prev => { const u = { ...prev }; delete u[name]; return u; });
        setFormError('');
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (date) => {
        setErrors(prev => { const u = { ...prev }; delete u.birth_date; return u; });
        setFormError('');
        setFormData(prev => ({ ...prev, birth_date: date }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }

        setLoading(true);
        try {
            const result = await updatePatient(Number(patient.id || patient.user_id), {
                ...formData,
                birth_date: toLocalYYYYMMDD(formData.birth_date),
            });
            setPatient(prev => ({
                ...result.user,
                avatar: result.user?.avatar || prev.avatar,
            }));
            onClose();
        } catch (err) {
            setFormError(err.response?.data?.error || t('patient_form.errors.update_failed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>

                <div className={styles.modalHeader}>
                    <div className={styles.modalTitleRow}>
                        <FaUserEdit className={styles.modalTitleIcon} />
                        <h3 className={styles.title}>{t('patient_form.edit_title')}</h3>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}><FaTimes size={16} /></button>
                </div>

                <form className={styles.form} onSubmit={handleSubmit} noValidate>
                    <div className={styles.row}>
                        {[
                            { name: 'last_name',  label: t('patient_form.last_name')  },
                            { name: 'first_name', label: t('patient_form.first_name') },
                            { name: 'patronymic', label: t('patient_form.patronymic') },
                        ].map(({ name, label }) => (
                            <div key={name} className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>{label}</label>
                                <input
                                    type="text"
                                    name={name}
                                    value={formData[name]}
                                    onChange={handleChange}
                                    className={`${styles.input} ${errors[name] ? styles.inputError : ''}`}
                                    placeholder={label}
                                />
                                {errors[name] && <span className={styles.error}>{errors[name]}</span>}
                            </div>
                        ))}
                    </div>

                    <div className={styles.row}>
                        <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel}>{t('patient_form.birth_date')}</label>
                            <MuiDatePicker
                                value={formData.birth_date}
                                onChange={handleDateChange}
                                error={!!errors.birth_date}
                            />
                            {errors.birth_date && <span className={styles.error}>{errors.birth_date}</span>}
                        </div>
                        <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel}>{t('patient_form.phone')}</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder={phonePlaceholder}
                                className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
                            />
                            {errors.phone && <span className={styles.error}>{errors.phone}</span>}
                        </div>
                        <div className={styles.fieldGroup}>
                            <label className={styles.fieldLabel}>{t('patient_form.email')}</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="example@email.com"
                                className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                            />
                            {errors.email && <span className={styles.error}>{errors.email}</span>}
                        </div>
                    </div>

                    <div className={styles.fieldGroupFull}>
                        <label className={styles.fieldLabel}>{t('patient_form.address')}</label>
                        <input
                            type="text"
                            name="contact_info"
                            value={formData.contact_info}
                            onChange={handleChange}
                            placeholder={t('patient_form.address')}
                            className={`${styles.input} ${errors.contact_info ? styles.inputError : ''}`}
                        />
                        {errors.contact_info && <span className={styles.error}>{errors.contact_info}</span>}
                    </div>

                    {formError && <div className={styles.errorMessage}>{formError}</div>}

                    <div className={styles.actions}>
                        <button type="button" className={styles.cancel} onClick={onClose}>
                            {t('patient_form.cancel')}
                        </button>
                        <button type="submit" className={styles.confirm} disabled={loading}>
                            {loading ? '...' : t('patient_form.save_changes')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditPatientModal;