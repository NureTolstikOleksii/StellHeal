import React, { useState } from 'react';
import styles from './AddPatientModal.module.css';
import { useTranslation } from 'react-i18next';
import MuiDatePicker from '../DatePicker/MuiDatePicker.jsx';
import { createPatient } from '../../services/patientService';

const AddPatientModal = ({ onClose, setPatients }) => {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language;

    const [formData, setFormData] = useState({
        last_name: '',
        first_name: '',
        patronymic: '',
        email: '',
        phone: '',
        address: '',
        birth_date: null,
    });

    const [formError, setFormError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormError(''); // ⬅ очищення при зміні
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (date) => {
        setFormError(''); // ⬅ очищення при виборі дати
        setFormData(prev => ({ ...prev, birth_date: date }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        setLoading(true);

        // Перевірка, чи всі поля заповнені
        const allFieldsFilled = Object.entries(formData).every(([, value]) => {
            return value !== null && value !== '';
        });

        if (!allFieldsFilled) {
            setFormError(t('patient_form.errors.required'));
            setLoading(false);
            return;
        }

        try {
            const response = await createPatient({
                ...formData,
                birth_date: toLocalYYYYMMDD(formData.birth_date)
            });

            setPatients(prev => [...prev, {
                id: response.userId,
                name: `${formData.last_name} ${formData.first_name} ${formData.patronymic}`,
                email: formData.email,
                phone: formData.phone,
                address: formData.address,
                dob: formData.birth_date?.toLocaleDateString('uk-UA'),
                avatar: null
            }]);

            onClose();
        } catch (err) {
            if (err.response && err.response.data && err.response.data.error) {
                setFormError(err.response.data.error);
            } else {
                setFormError(t('patient_form.errors.creation_failed'));
            }
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const phonePlaceholder = currentLang === 'uk' ? '+38 (0...)...' : '+1 (___) ___-____';

    function toLocalYYYYMMDD(date) {
        if (!date) return null;
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <h3 className={styles.title}>{t('patient_form.title')}</h3>
                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.row}>
                        <input
                            type="text"
                            name="last_name"
                            placeholder={t('patient_form.last_name')}
                            value={formData.last_name}
                            onChange={handleChange}
                        />
                        <input
                            type="text"
                            name="first_name"
                            placeholder={t('patient_form.first_name')}
                            value={formData.first_name}
                            onChange={handleChange}
                        />
                        <input
                            type="text"
                            name="patronymic"
                            placeholder={t('patient_form.patronymic')}
                            value={formData.patronymic}
                            onChange={handleChange}
                        />
                    </div>
                    <div className={styles.row}>
                        <MuiDatePicker
                            value={formData.birth_date}
                            onChange={handleDateChange}
                        />
                        <input
                            type="tel"
                            name="phone"
                            placeholder={phonePlaceholder}
                            value={formData.phone}
                            onChange={handleChange}
                        />
                        <input
                            type="text"
                            name="email"
                            placeholder={t('patient_form.email')}
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>
                    <div className={styles.row}>
                        <input
                            type="text"
                            name="address"
                            placeholder={t('patient_form.address')}
                            value={formData.address}
                            onChange={handleChange}
                        />
                    </div>

                    {formError && <div className={styles.errorMessage}>{formError}</div>}

                    <div className={styles.actions}>
                        <button type="submit" className={styles.confirm} disabled={loading}>
                            {loading ? t('loading') : t('patient_form.confirm')}
                        </button>
                        <button type="button" className={styles.cancel} onClick={onClose}>
                            {t('patient_form.cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddPatientModal;
