import React, { useEffect, useState } from 'react';
import styles from './AddPrescriptionModal.module.css';
import { fetchAvailableWards, fetchMedications } from '../../../services/patientService';
import { FaTimes } from 'react-icons/fa';
import Select from 'react-select';
import { useTranslation } from 'react-i18next';

const AddPrescriptionModal = ({ onClose, onSubmit }) => {
    const { t } = useTranslation();
    const [diagnosis, setDiagnosis] = useState('');
    const [medications, setMedications] = useState([
        { medicationId: '', quantity: '', timesPerDay: '', duration: '' }
    ]);
    const [availableMeds, setAvailableMeds] = useState([]);
    const [wardId, setWardId] = useState('');
    const [availableWards, setAvailableWards] = useState([]);
    const [formError, setFormError] = useState('');

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const meds = await fetchMedications();
                const wards = await fetchAvailableWards();
                setAvailableMeds(meds);
                setAvailableWards(wards);
            } catch (err) {
                console.error('Помилка при завантаженні:', err);
            }
        };
        loadInitialData();
    }, []);

    const handleChange = (index, field, value) => {
        const updated = [...medications];
        updated[index][field] = value;
        setMedications(updated);
    };

    const handleAddMedication = () => {
        setMedications([...medications, { medicationId: '', quantity: '', timesPerDay: '', duration: '' }]);
    };

    const handleRemoveMedication = (index) => {
        setMedications(medications.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!diagnosis || !wardId || medications.some(med =>
            !med.medicationId || !med.quantity || !med.timesPerDay || !med.duration
        )) {
            setFormError(t('prescription_form.errors.required'));
            return;
        }

        try {
            await onSubmit({ diagnosis, wardId, medications });
            onClose();
        } catch (err) {
            console.error('Помилка у формі створення:', err);
            alert(t('prescription_form.errors.create_failed'));
        }
    };

    const customSelectStyles = {
        control: (provided,) => ({
            ...provided,
            backgroundColor: 'white',
            borderColor: 'white',
            borderRadius: '10px',
            height: '36px',
            minHeight: '36px',
            width: '100%',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center', // Центрує текст по вертикалі
            boxShadow: 'none',
            whiteSpace: 'nowrap',
            cursor: 'pointer'
        }),
        valueContainer: (provided) => ({
            ...provided,
            padding: '0 12px',
            height: '100%',
            display: 'flex',
            alignItems: 'center' // Центрує текст у valueContainer
        }),
        input: (provided) => ({
            ...provided,
            margin: '0px',
            padding: '0px',
        }),
        indicatorsContainer: (provided) => ({
            ...provided,
            paddingRight: '8px',
            display: 'flex',
            alignItems: 'center'
        }),
        dropdownIndicator: (provided, state) => ({
            ...provided,
            color: '#666',
            transition: 'transform 0.2s ease',
            transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : null,
            '&:hover': {
                color: '#333',
            }
        }),
        indicatorSeparator: () => ({
            display: 'none'
        }),
        menu: (provided) => ({
            ...provided,
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
            zIndex: 9999,
        }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isFocused ? '#8bb5ed' : 'white',
            color: state.isFocused ? 'white' : 'black',
            cursor: 'pointer',
            padding: '10px 12px',
        }),
        singleValue: (provided) => ({
            ...provided,
            color: '#333',
            maxWidth: '80%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        }),
        placeholder: (provided) => ({
            ...provided,
            color: '#999',
            maxWidth: '80%',
            display: 'flex',
            alignItems: 'center',
        })
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modal}>
                <h3>{t('prescription_form.title')}</h3>

                {formError && <div className={styles.formError}>{formError}</div>}

                <label>{t('prescription_form.diagnosis')}</label>
                <input
                    type="text"
                    className={styles.input}
                    value={diagnosis}
                    onChange={e => setDiagnosis(e.target.value)}
                />
                <label>{t('prescription_form.ward')}</label>
                <select
                    value={wardId}
                    onChange={e => setWardId(Number(e.target.value))}
                    className={styles.input}
                >
                    <option value="">{t('prescription_form.select_ward')}</option>
                    {availableWards.map(w => (
                        <option key={w.id} value={w.id}>
                            {t('prescription_form.ward_number')} {w.number}
                        </option>
                    ))}
                </select>

                <p>{t('prescription_form.medications')}</p>
                {medications.map((med, i) => (
                    <div key={i} className={styles.medBlock}>
                        <span className={styles.medLabel}>
                            {t('prescription_form.medication')} {i + 1}
                        </span>
                        <Select
                            className={styles.select}
                            styles={customSelectStyles}
                            classNamePrefix="react-select"
                            placeholder={t('prescription_form.select_med')}
                            options={availableMeds.map(m => ({
                                value: m.id,
                                label: m.name
                            }))}
                            value={availableMeds.find(m => m.id === med.medicationId) ? {
                                value: med.medicationId,
                                label: availableMeds.find(m => m.id === med.medicationId)?.name
                            } : null}
                            onChange={selected => handleChange(i, 'medicationId', selected?.value)}
                        />
                        <input
                            type="number"
                            placeholder={t('prescription_form.quantity')}
                            value={med.quantity}
                            onChange={e => handleChange(i, 'quantity', e.target.value)}
                        />
                        <input
                            type="number"
                            placeholder={t('prescription_form.times_per_day')}
                            value={med.timesPerDay}
                            onChange={e => handleChange(i, 'timesPerDay', e.target.value)}
                        />
                        <input
                            type="number"
                            placeholder={t('prescription_form.duration')}
                            value={med.duration}
                            onChange={e => handleChange(i, 'duration', e.target.value)}
                        />
                        <span className={styles.hideOnMobile}>{t('prescription_form.days')}</span>
                        <button className={styles.removeBtn} onClick={() => handleRemoveMedication(i)}>
                            <FaTimes />
                        </button>
                    </div>
                ))}

                <button className={styles.addBtn} onClick={handleAddMedication}>＋</button>

                <div className={styles.actions}>
                    <button className={styles.confirmBtn} onClick={handleSubmit}>
                        {t('prescription_form.confirm')}
                    </button>
                    <button className={styles.cancelBtn} onClick={onClose}>
                        {t('prescription_form.cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddPrescriptionModal;
