import React, { useState } from 'react';
import styles from './Login.module.css';
import logo from '../../assets/logo.png';
import Input from '../../components/Input/LoginInput.jsx';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import ForgotPasswordModal from './ForgotPasswordModal.jsx';
import LoaderOverlay from "../../components/LoaderOverlay/LoaderOverlay.jsx";

const Login = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPageLoader, setShowPageLoader] = useState(false);
    const [showForgotModal, setShowForgotModal] = useState(false);

    const handleLogin = async () => {
        setError('');
        setIsLoading(true);
        try {
            const response = await loginUser(email, password);
            login(response.token, response.user);
            setShowPageLoader(true);
            setTimeout(() => {
                navigate('/main/profile');
            }, 600);
        } catch (err) {
            const serverError = err.response?.data?.message || 'Помилка з\'єднання з сервером'
            setError(serverError);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.loginPage}>
            <div className={styles.loginContainer}>
                <div className={styles.logoBlock}>
                    <img src={logo} alt="Healthy Helper" className={styles.logo} />
                    <h1>HealthyHelper</h1>
                    <p>Medical Service</p>
                </div>

                <div className={styles.formBlock}>
                    <h2>Welcome back!</h2>
                    {error && (
                        <div className={styles.errorBanner}>
                            <span className={styles.errorIcon}></span>
                            <span>{error}</span>
                        </div>
                    )}
                    <Input
                        label="Email address"
                        placeholder="example@gmail.com"
                        value={email}
                        onChange={(val) => {
                            setEmail(val);
                            if (error) setError('');
                        }}
                    />
                    <Input
                        label="Password"
                        placeholder="Password"
                        type="password"
                        value={password}
                        onChange={(val) => {
                            setPassword(val);
                            if (error) setError('');
                        }}
                    />
                    <button
                        type="button"
                        className={styles.button}
                        onClick={handleLogin}
                        disabled={isLoading}
                    >
                        {isLoading ? <span className={styles.spinner}></span> : 'LOG IN'}
                    </button>
                    <a href="#" className={styles.forgotLink} onClick={() => setShowForgotModal(true)}>Forgot password?</a>
                    {showPageLoader && <LoaderOverlay />}
                    {showForgotModal && <ForgotPasswordModal onClose={() => setShowForgotModal(false)} />}
                </div>
            </div>
        </div>
    );
};

export default Login;
