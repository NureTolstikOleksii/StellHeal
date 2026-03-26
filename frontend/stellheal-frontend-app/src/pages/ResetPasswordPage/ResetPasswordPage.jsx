import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './ResetPasswordPage.css';
import { resetPassword } from '../../services/authService.js';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import LoaderOverlay from "../../components/LoaderOverlay/LoaderOverlay.jsx";

const ResetPasswordPage = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPageLoader, setShowPageLoader] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!password || !confirmPassword) {
            return setError('Усі поля обовʼязкові');
        }

        if (password !== confirmPassword) {
            return setError('Паролі не збігаються');
        }

        setLoading(true);
        try {
            await resetPassword(token, password);
            setSuccess('Пароль успішно змінено! Перенаправлення...');
            setTimeout(() => {
                setShowPageLoader(true);
                navigate('/');
            }, 500);
        } catch (err) {
            setError(err.response?.data?.message || 'Помилка скидання пароля');
        } finally {
            setLoading(false);
        }
    };

    if (!token) return <div className="reset-container">Невалідне посилання</div>;

    return (
        <div className="reset-container">
            <h2>Зміна пароля</h2>
            <form onSubmit={handleSubmit}>
                <div className="input-block">
                    <label>Новий пароль</label>
                    <div className="input-wrapper">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Новий пароль"
                        />
                        <span className="eye-icon" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </span>
                    </div>
                </div>

                <div className="input-block">
                    <label>Підтвердіть новий пароль</label>
                    <div className="input-wrapper">
                        <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Підтвердіть новий пароль"
                        />
                        <span className="eye-icon" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                            {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                        </span>
                    </div>
                </div>

                {error && (
                    <div className="error-message" dangerouslySetInnerHTML={{ __html: error.replace(/\n/g, '<br/>') }} />
                )}
                {success && <div className="success-message">{success}</div>}

                <button type="submit" disabled={loading}>
                    {loading ? 'Зачекайте...' : 'Змінити пароль'}
                </button>
            </form>
            {showPageLoader && <LoaderOverlay />}
        </div>
    );
};

export default ResetPasswordPage;
