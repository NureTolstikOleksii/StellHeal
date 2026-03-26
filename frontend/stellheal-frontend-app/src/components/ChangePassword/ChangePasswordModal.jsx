import React, { useState } from 'react';
import styles from './ChangePasswordModal.module.css';
import { useTranslation } from 'react-i18next';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const ChangePasswordModal = ({ passwordForm, onChange, onSubmit, onClose, errors = {} }) => {
    const { t } = useTranslation();

    const [show, setShow] = useState({
        newPassword: false,
        confirmPassword: false,
    });

    const toggleVisibility = (field) => {
        setShow(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit();
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modal}>
                <h3>{t('profile.change_password')}</h3>
                <form onSubmit={handleSubmit} noValidate>

                    <div className={styles.inputWrapper}>
                        <input
                            type="text"
                            name="currentPassword"
                            placeholder={t('profile.current_password')}
                            value={passwordForm.currentPassword}
                            onChange={onChange}
                            className={errors.currentPassword ? styles.inputError : ''}
                        />
                        {errors.currentPassword && <div className={styles.error}>{errors.currentPassword}</div>}
                    </div>

                    <div className={styles.inputWrapper}>
                        <div className={styles.inputWithIcon}>
                            <input
                                type={show.newPassword ? 'text' : 'password'}
                                name="newPassword"
                                placeholder={t('profile.new_password')}
                                value={passwordForm.newPassword}
                                onChange={onChange}
                                className={errors.newPassword ? styles.inputError : ''}
                            />
                            <span onClick={() => toggleVisibility('newPassword')} className={styles.eyeIcon}>
                                {show.newPassword ? <FaEyeSlash /> : <FaEye />}
                            </span>
                        </div>
                        {errors.newPassword && <div className={styles.error}>{errors.newPassword}</div>}
                    </div>

                    <div className={styles.inputWrapper}>
                        <div className={styles.inputWithIcon}>
                            <input
                                type={show.confirmPassword ? 'text' : 'password'}
                                name="confirmPassword"
                                placeholder={t('profile.confirm_password')}
                                value={passwordForm.confirmPassword}
                                onChange={onChange}
                                className={errors.confirmPassword ? styles.inputError : ''}
                            />
                            <span onClick={() => toggleVisibility('confirmPassword')} className={styles.eyeIcon}>
                                {show.confirmPassword ? <FaEyeSlash /> : <FaEye />}
                            </span>
                        </div>
                        {errors.newPassword && <div className={styles.error}>{errors.newPassword}</div>}
                        {errors.confirmPassword && <div className={styles.error}>{errors.confirmPassword}</div>}
                    </div>

                    <div className={styles.modalActions}>
                        <button type="submit" className={styles.saveBtn}>{t('profile.save')}</button>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>{t('profile.cancel')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
