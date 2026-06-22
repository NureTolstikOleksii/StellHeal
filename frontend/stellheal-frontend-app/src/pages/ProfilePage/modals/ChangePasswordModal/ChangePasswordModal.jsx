import React, { useState } from 'react';
import styles from './ChangePasswordModal.module.css';
import { useTranslation } from 'react-i18next';
import { FaEye, FaEyeSlash, FaLock, FaTimes } from 'react-icons/fa';

const Field = ({ name, label, placeholder, show, toggle, passwordForm, onChange, errors }) => (
    <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>{label}</label>
        <div className={styles.inputWrapper}>
            <FaLock className={styles.inputIcon} />
            <input
                type={show[name] ? 'text' : 'password'}
                name={name}
                placeholder={placeholder}
                value={passwordForm[name]}
                onChange={onChange}
                className={`${styles.input} ${errors[name] ? styles.inputError : ''}`}
                autoComplete="off"
            />
            <span className={styles.eyeBtn} onClick={() => toggle(name)}>
                {show[name] ? <FaEyeSlash /> : <FaEye />}
            </span>
        </div>
        {errors[name] && <div className={styles.error}>{errors[name]}</div>}
    </div>
);

const ChangePasswordModal = ({ passwordForm, onChange, onSubmit, onClose, errors = {} }) => {
    const { t } = useTranslation();

    const [show, setShow] = useState({
        currentPassword: false,
        newPassword:     false,
        confirmPassword: false,
    });

    const toggle = (field) => setShow(prev => ({ ...prev, [field]: !prev[field] }));

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit();
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <div className={styles.modalTitleRow}>
                        <FaLock className={styles.modalTitleIcon} />
                        <h3 className={styles.modalTitle}>{t('profile.change_password')}</h3>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <FaTimes size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} noValidate className={styles.form}>
                    <Field
                        name="currentPassword"
                        label={t('profile.current_password')}
                        placeholder={t('profile.current_password')}
                        show={show}
                        toggle={toggle}
                        passwordForm={passwordForm}
                        onChange={onChange}
                        errors={errors}
                    />
                    <Field
                        name="newPassword"
                        label={t('profile.new_password')}
                        placeholder={t('profile.new_password')}
                        show={show}
                        toggle={toggle}
                        passwordForm={passwordForm}
                        onChange={onChange}
                        errors={errors}
                    />
                    <Field
                        name="confirmPassword"
                        label={t('profile.confirm_password')}
                        placeholder={t('profile.confirm_password')}
                        show={show}
                        toggle={toggle}
                        passwordForm={passwordForm}
                        onChange={onChange}
                        errors={errors}
                    />

                    <div className={styles.actions}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>
                            {t('common.cancel')}
                        </button>
                        <button type="submit" className={styles.saveBtn}>
                            {t('common.save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;