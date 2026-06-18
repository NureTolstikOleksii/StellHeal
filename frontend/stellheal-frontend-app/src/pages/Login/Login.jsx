import React, { useState, useEffect } from 'react';
import styles from './Login.module.css';
import logo from '../../assets/logo.png';
import { useNavigate } from 'react-router-dom';;
import { useAuth } from '../../context/AuthContext';
import ForgotPasswordModal from './modals/ForgotPasswordModal/ForgotPasswordModal.jsx';
import LoaderOverlay from '../../components/LoaderOverlay/LoaderOverlay.jsx';
import Toast from '../../components/Toast/Toast.jsx';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Login = () => {
    const navigate = useNavigate();
    const { login, accessToken } = useAuth();

    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [errors, setErrors]     = useState({});
    const [isLoading, setIsLoading]         = useState(false);
    const [showPageLoader, setShowPageLoader] = useState(false);
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [toast, setToast] = useState({ open: false, type: 'error', title: '', message: '' });

    useEffect(() => {
        if (accessToken) navigate('/main/profile');
    }, [accessToken]);

    const showToast = (type, title, message = '') =>
        setToast({ open: true, type, title, message });

    const validate = () => {
        const e = {};
        if (!email.trim())             e.email    = 'Введіть email';
        else if (!EMAIL_RE.test(email)) e.email   = 'Невірний формат email';
        if (!password.trim())           e.password = 'Введіть пароль';
        return e;
    };

    const getErrorMessage = (err) => {
        const code = err.response?.data?.code;
        const messages = {
            'INVALID_PASSWORD': 'Невірний пароль. Перевірте введені дані.',
            'USER_NOT_FOUND':   'Користувача з таким email не знайдено.',
            'ACCOUNT_LOCKED':   'Акаунт тимчасово заблоковано через багато невдалих спроб. Спробуйте через 5 хвилин.',
            'FORBIDDEN':        'Доступ до системи заборонено для вашої ролі.',
            'VALIDATION_ERROR': 'Перевірте правильність введених даних.',
        };
        return messages[code] || err.response?.data?.message || "Помилка з'єднання з сервером";
    };

    const handleLogin = async () => {
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }

        setErrors({});
        setIsLoading(true);
        try {
            await login(email, password);
            showToast('success', 'Вхід успішний', 'Перенаправляємо...');
            setShowPageLoader(true);
            setTimeout(() => navigate('/main/profile'), 800);
        } catch (err) {
            showToast('error', 'Помилка входу', getErrorMessage(err)); // ← замінити
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleLogin();
    };

    return (
        <div className={styles.page}>
            <div className={styles.card}>

                <div className={styles.logoBlock}>
                    <img src={logo} alt="StellHeal" className={styles.logo} />
                    <h1 className={styles.appName}>StellHeal</h1>
                    <p className={styles.appSub}>Medical Service</p>
                </div>

                <div className={styles.formSide}>
                    <div className={styles.formBlock}>
                        <h2 className={styles.formTitle}>Вхід до системи</h2>
                        <p className={styles.formSubtitle}>Введіть ваші облікові дані</p>

                        <div className={styles.fieldGroup}>
                            <label className={styles.label}>Email</label>
                            <div className={`${styles.inputWrapper} ${errors.email ? styles.inputWrapperError : ''}`}>
                                <FaEnvelope className={styles.inputIcon} />
                                <input
                                    type="email"
                                    className={styles.input}
                                    placeholder="example@gmail.com"
                                    value={email}
                                    onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })); }}
                                    onKeyDown={handleKeyDown}
                                    autoComplete="email"
                                />
                            </div>
                            {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
                        </div>

                        <div className={styles.fieldGroup}>
                            <label className={styles.label}>Пароль</label>
                            <div className={`${styles.inputWrapper} ${errors.password ? styles.inputWrapperError : ''}`}>
                                <FaLock className={styles.inputIcon} />
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    className={styles.input}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
                                    onKeyDown={handleKeyDown}
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className={styles.eyeBtn}
                                    onClick={() => setShowPass(p => !p)}
                                    tabIndex={-1}
                                >
                                    {showPass ? <FaEyeSlash size={15} /> : <FaEye size={15} />}
                                </button>
                            </div>
                            {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
                        </div>

                        <div className={styles.forgotRow}>
                            <button
                                type="button"
                                className={styles.forgotLink}
                                onClick={() => setShowForgotModal(true)}
                            >
                                Забули пароль?
                            </button>
                        </div>

                        <button
                            type="button"
                            className={styles.submitBtn}
                            onClick={handleLogin}
                            disabled={isLoading}
                        >
                            {isLoading
                                ? <span className={styles.spinner} />
                                : 'Увійти'
                            }
                        </button>
                    </div>
                </div>
            </div>

            {showPageLoader && <LoaderOverlay />}

            {showForgotModal && (
                <ForgotPasswordModal onClose={() => setShowForgotModal(false)} />
            )}

            <Toast
                open={toast.open}
                type={toast.type}
                title={toast.title}
                message={toast.message}
                onClose={() => setToast(p => ({ ...p, open: false }))}
            />
        </div>
    );
};

export default Login;