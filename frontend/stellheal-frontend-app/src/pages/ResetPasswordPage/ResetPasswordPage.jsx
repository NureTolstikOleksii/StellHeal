import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import styles from './ResetPasswordPage.module.css';
import { resetPassword } from '../../services/authService.js';
import { FaEye, FaEyeSlash, FaLock, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { MdLockReset } from 'react-icons/md';
import LoaderOverlay from '../../components/LoaderOverlay/LoaderOverlay.jsx';
import logo from '../../assets/logo.png';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

const ResetPasswordPage = () => {
    const [searchParams] = useSearchParams();
    const token    = searchParams.get('token');
    const navigate = useNavigate();

    const [password, setPassword]               = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPass, setShowPass]               = useState(false);
    const [showConfirm, setShowConfirm]         = useState(false);
    const [errors, setErrors]                   = useState({});
    const [success, setSuccess]                 = useState(false);
    const [serverError, setServerError]         = useState('');
    const [loading, setLoading]                 = useState(false);
    const [showPageLoader, setShowPageLoader]   = useState(false);

    const validate = () => {
        const e = {};
        if (!password)                          e.password = "Введіть новий пароль";
        else if (!PASSWORD_REGEX.test(password)) e.password = "Мінімум 8 символів: велика, мала літера, цифра та спецсимвол";
        if (!confirmPassword)                   e.confirm  = "Підтвердіть пароль";
        else if (password !== confirmPassword)  e.confirm  = "Паролі не збігаються";
        return e;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setServerError('');
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }

        setLoading(true);
        try {
            await resetPassword(token, password);
            setSuccess(true);
            setTimeout(() => {
                setShowPageLoader(true);
                navigate('/');
            }, 2500);
        } catch (err) {
            setServerError(err.response?.data?.message || 'Помилка скидання пароля. Спробуйте ще раз.');
        } finally {
            setLoading(false);
        }
    };

    if (!token) return (
        <div className={styles.page}>
            <div className={styles.card}>
                <FaExclamationCircle className={styles.invalidIcon} />
                <h2 className={styles.invalidTitle}>Недійсне посилання</h2>
                <p className={styles.invalidText}>Посилання для відновлення пароля недійсне або застаріло.</p>
                <button className={styles.backBtn} onClick={() => navigate('/')}>
                    Повернутись до входу
                </button>
            </div>
        </div>
    );

    return (
        <div className={styles.page}>
            <div className={styles.card}>

                {/* Logo */}
                <div className={styles.logoBlock}>
                    <img src={logo} alt="StellHeal" className={styles.logo} />
                    <span className={styles.appName}>StellHeal</span>
                </div>

                {/* Header */}
                <div className={styles.header}>
                    <MdLockReset className={styles.headerIcon} />
                    <h2 className={styles.title}>Зміна пароля</h2>
                </div>

                {success ? (
                    <div className={styles.successBlock}>
                        <FaCheckCircle className={styles.successIcon} />
                        <p className={styles.successTitle}>Пароль успішно змінено!</p>
                        <p className={styles.successText}>Перенаправляємо на сторінку входу...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} noValidate className={styles.form}>
                        <p className={styles.subtitle}>Введіть новий пароль для вашого акаунту</p>

                        {/* Новий пароль */}
                        <div className={styles.fieldGroup}>
                            <label className={styles.label}>Новий пароль</label>
                            <div className={`${styles.inputWrapper} ${errors.password ? styles.inputWrapperError : ''}`}>
                                <FaLock className={styles.inputIcon} />
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    className={styles.input}
                                    placeholder="Мінімум 8 символів"
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
                                    autoComplete="new-password"
                                />
                                <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(p => !p)}>
                                    {showPass ? <FaEyeSlash size={15} /> : <FaEye size={15} />}
                                </button>
                            </div>
                            {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
                        </div>

                        {/* Підтвердження */}
                        <div className={styles.fieldGroup}>
                            <label className={styles.label}>Підтвердіть пароль</label>
                            <div className={`${styles.inputWrapper} ${errors.confirm ? styles.inputWrapperError : ''}`}>
                                <FaLock className={styles.inputIcon} />
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    className={styles.input}
                                    placeholder="Повторіть пароль"
                                    value={confirmPassword}
                                    onChange={e => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirm: '' })); }}
                                    autoComplete="new-password"
                                />
                                <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirm(p => !p)}>
                                    {showConfirm ? <FaEyeSlash size={15} /> : <FaEye size={15} />}
                                </button>
                            </div>
                            {errors.confirm && <span className={styles.fieldError}>{errors.confirm}</span>}
                        </div>

                        {/* Підказка вимог */}
                        <div className={styles.hint}>
                            Пароль має містити: велику і малу літеру, цифру та спецсимвол
                        </div>

                        {serverError && <div className={styles.errorMsg}>{serverError}</div>}

                        <button type="submit" className={styles.submitBtn} disabled={loading}>
                            {loading ? <span className={styles.spinner} /> : 'Змінити пароль'}
                        </button>

                    </form>
                )}
            </div>

            {showPageLoader && <LoaderOverlay />}
        </div>
    );
};

export default ResetPasswordPage;