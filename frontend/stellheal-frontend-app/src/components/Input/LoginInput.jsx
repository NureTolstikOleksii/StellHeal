import React, { useState } from 'react';
import styles from './LoginInput.module.css';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const Input = ({ label, placeholder, type = "text", value, onChange }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPasswordType = type === 'password';

    const togglePasswordVisibility = () => setShowPassword(prev => !prev);

    return (
        <div className={styles.inputBlock}>
            <label>{label}</label>
            <div className={styles.inputWrapper}>
                <input
                    type={isPasswordType ? (showPassword ? 'text' : 'password') : type}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
                {isPasswordType && (
                    <span className={styles.eyeIcon} onClick={togglePasswordVisibility}>
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </span>
                )}
            </div>
        </div>
    );
};


export default Input;
