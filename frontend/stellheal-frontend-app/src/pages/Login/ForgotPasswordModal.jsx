import React, { useState } from 'react';
import styles from './ForgotPasswordModal.module.css';
import { sendResetEmail } from '../../services/authService.js';

const ForgotPasswordModal = ({ onClose }) => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setIsSubmitting(true);

        try {
            const res = await sendResetEmail(email);
            if (res.data.type === 'success') {
                setMessage(res.data.message);
                setTimeout(() => onClose(), 2000);
            } else {
                setError(res.data.message);
            }
        } catch (err) {
            const fallbackMessage = err.response?.data?.message || 'Unexpected error';
            setError(fallbackMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <h2>Forgot Password</h2>
                <p>Enter your email and we'll send you reset instructions.</p>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    {message && <p className={styles.success}>{message}</p>}
                    {error && <p className={styles.error}>{error}</p>}
                    <button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Sending...' : 'Send Email'}
                    </button>
                </form>
                <button className={styles.closeBtn} onClick={onClose}>Close</button>
            </div>
        </div>
    );
};

export default ForgotPasswordModal;
