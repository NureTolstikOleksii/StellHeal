import React, { useState } from 'react';
import styles from './ForgotPasswordModal.module.css';
import { sendResetEmail } from '../../../../services/authService.js';
import { FaEnvelope, FaTimes, FaCheckCircle } from 'react-icons/fa';
import { MdLockReset } from 'react-icons/md';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPasswordModal = ({ onClose }) => {
    const [email, setEmail]           = useState('');
    const [emailError, setEmailError] = useState('');
    const [success, setSuccess]       = useState(false);
    const [error, setError]           = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const validate = () => {
        if (!email.trim())            return 'Введіть email адресу';
        if (!EMAIL_RE.test(email))    return 'Невірний формат email';
        return '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const err = validate();
        if (err) { setEmailError(err); return; }

        setEmailError('');
        setError('');
        setIsSubmitting(true);

        try {
            await sendResetEmail(email);
            setSuccess(true);
            setTimeout(() => onClose(), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Сталася помилка. Спробуйте пізніше.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className={styles.modalHeader}>
                    <div className={styles.modalTitleRow}>
                        <MdLockReset className={styles.modalTitleIcon} />
                        <h3 className={styles.title}>Відновлення паролю</h3>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <FaTimes size={15} />
                    </button>
                </div>

                {/* Success state */}
                {success ? (
                    <div className={styles.successBlock}>
                        <FaCheckCircle className={styles.successIcon} />
                        <p className={styles.successTitle}>Листа надіслано!</p>
                        <p className={styles.successText}>
                            Перевірте вашу поштову скриньку <strong>{email}</strong> і дотримуйтесь інструкцій.
                        </p>
                    </div>
                ) : (
                    <>
                        <p className={styles.subtitle}>
                            Введіть email і ми надішлемо інструкції для відновлення паролю.
                        </p>

                        <form onSubmit={handleSubmit} noValidate className={styles.form}>
                            <div className={styles.fieldGroup}>
                                <label className={styles.label}>Email</label>
                                <div className={`${styles.inputWrapper} ${emailError ? styles.inputWrapperError : ''}`}>
                                    <FaEnvelope className={styles.inputIcon} />
                                    <input
                                        type="email"
                                        className={styles.input}
                                        placeholder="example@gmail.com"
                                        value={email}
                                        onChange={e => { setEmail(e.target.value); setEmailError(''); setError(''); }}
                                        autoComplete="email"
                                    />
                                </div>
                                {emailError && <span className={styles.fieldError}>{emailError}</span>}
                            </div>

                            {error && <div className={styles.errorMsg}>{error}</div>}

                            <div className={styles.actions}>
                                <button type="button" className={styles.cancelBtn} onClick={onClose}>
                                    Скасувати
                                </button>
                                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                                    {isSubmitting
                                        ? <span className={styles.spinner} />
                                        : 'Надіслати'
                                    }
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};

export default ForgotPasswordModal;