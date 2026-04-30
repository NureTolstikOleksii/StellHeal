import React, { useRef, useEffect, useState } from 'react';
import styles from './ProfilePage.module.css';
import { useTranslation } from 'react-i18next';
import { MdEdit } from 'react-icons/md';
import {
    getProfile,
    uploadAvatar,
    changePassword,
    updateProfile
} from '../../services/profileService';
import { useAuth } from '../../context/AuthContext.jsx';
import ChangePasswordModal from '../../components/ChangePassword/ChangePasswordModal.jsx';
import defaultAvatar from '../../assets/default_avatar.svg';

const ProfilePage = () => {
    const { user, setUser } = useAuth();
    const { t } = useTranslation();
    const fileInputRef = useRef(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [profileData, setProfileData] = useState(null);
    const [errors, setErrors] = useState({});
    const isAdmin = user?.role === 'admin';

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const handleEditClick = () => fileInputRef.current.click();

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const res = await uploadAvatar(file);

            const newAvatar = res.avatar;

            // ✅ оновлюємо profile (локально)
            setProfileData(prev => ({
                ...prev,
                avatar: newAvatar
            }));

            // ✅ створюємо НОВИЙ user (важливо!)
            const updatedUser = {
                ...user,
                avatar: newAvatar
            };

            // ✅ оновлюємо context
            setUser(updatedUser);

            // ✅ синхронізуємо localStorage
            localStorage.setItem('user', JSON.stringify(updatedUser));

        } catch (err) {
            console.error('Помилка при завантаженні аватару:', err);
        }
    };
    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswordForm(prev => ({ ...prev, [name]: value }));
    };

    const handlePasswordSubmit = async () => {
        const { currentPassword, newPassword, confirmPassword } = passwordForm;
        const newErrors = {};
        if (!currentPassword) newErrors.currentPassword = t('profile.required');
        if (!newPassword) newErrors.newPassword = t('profile.required');
        if (newPassword !== confirmPassword) {
            newErrors.confirmPassword = t('profile.passwords_do_not_match');
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        try {
            await changePassword({ currentPassword, newPassword });
            alert(t('profile.password_changed_successfully'));
            setIsModalOpen(false);
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setErrors({});
        } catch (err) {
            console.error('Помилка при зміні паролю:', err);
            setErrors({ currentPassword: t('profile.password_change_error') });
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        setErrors(prev => {
            const updated = { ...prev };
            delete updated[name];
            delete updated.general;
            return updated;
        });

        setProfileData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        const requiredFields = ['first_name', 'last_name', 'patronymic', 'phone', 'email', 'contact_info'];
        const newErrors = {};

        requiredFields.forEach(field => {
            if (!profileData?.[field]?.trim()) {
                newErrors[field] = t('profile.required');
            }
        });

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        const payload = {
            ...profileData,
            login: profileData.email,
        };

        try {
            const updatedUser = await updateProfile(payload);
            const normalizedUser = {
                ...user,
                avatar: updatedUser.avatar,
                firstName: updatedUser.first_name,
                lastName: updatedUser.last_name,
                patronymic: updatedUser.patronymic,
                phone: updatedUser.phone,
                email: updatedUser.email,
                contact_info: updatedUser.contact_info
            };

            setUser(normalizedUser);
            localStorage.setItem('user', JSON.stringify(normalizedUser));
            alert(t('profile.saved_successfully'));
            setErrors({});
        } catch (err) {
            console.error('Помилка при збереженні профілю:', err);
            setErrors({ general: err.response?.data?.error || t('profile.save_error') });
        }
    };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const data = await getProfile();
                setProfileData({ ...data, email: data.login }); // важливо
            } catch (err) {
                console.error('Помилка завантаження профілю:', err);
            }
        };
        fetchProfile();
    }, []);

    return (
        <>
            <h2 className={styles.title}>{t('profile.title')}</h2>
            <div className={styles.formRow}>
                <div className={styles.fields}>
                    {[
                        { name: 'last_name', label: t('profile.last_name') },
                        { name: 'first_name', label: t('profile.first_name') },
                        { name: 'patronymic', label: t('profile.patronymic') },
                        { name: 'phone', label: t('profile.phone') },
                        { name: 'email', label: t('profile.email_field') },
                    ].map(({ name, label }) => (
                        <div key={name} className={styles.inputGroup}>
                            <label>{label}</label>
                            <input
                                type={name === 'email' ? 'email' : 'text'}
                                name={name}
                                value={profileData?.[name] || ''}
                                onChange={handleInputChange}
                                readOnly={!isAdmin}
                                className={`${styles.inputGroupInput} ${!isAdmin ? styles.disabledInput : styles.editableInput}`}
                            />
                            {errors[name] && <div className={styles.inputError}>{errors[name]}</div>}
                        </div>
                    ))}

                    {/* Додаємо поле роль або спеціалізація після email */}
                    <div className={styles.inputGroup}>
                        <label>
                            {isAdmin
                                ? `${t('profile.role')} ${t('profile.no-edit')}`
                                : t('profile.specialization')}
                        </label>
                        <input
                            type="text"
                            readOnly
                            value={
                                isAdmin
                                    ? t('profile.admin')
                                    : profileData?.medical_staff?.specialization || ''
                            }
                            className={styles.disabledInput}
                        />
                    </div>

                    {/* Адреса (повна ширина) */}
                    <div className={styles.inputGroupAddress}>
                        <label>{t('profile.address')}</label>
                        <input
                            type="text"
                            name="contact_info"
                            value={profileData?.contact_info || ''}
                            onChange={handleInputChange}
                            readOnly={!isAdmin}
                            className={`${styles.inputGroupInput} ${!isAdmin ? styles.disabledInput : styles.editableInput}`}
                        />
                        {errors.contact_info && (
                            <div className={styles.inputError}>{errors.contact_info}</div>
                        )}
                    </div>

                    {isAdmin && (
                        <div className={styles.actionRow}>
                            {errors.general && (
                                <div className={styles.formError}>{errors.general}</div>
                            )}
                            <button className={styles.saveButton} onClick={handleSave}>
                                {t('profile.save_changes')}
                            </button>
                        </div>
                    )}

                </div>


                <div className={styles.photoBlock}>
                    <img
                        src={profileData?.avatar || defaultAvatar}
                        alt="User avatar"
                        className={styles.avatar}
                    />
                    <button className={styles.editPhoto} onClick={handleEditClick}>
                        <MdEdit className={styles.editIcon} />
                    </button>
                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />

                    <button className={styles.saveButton} onClick={() => setIsModalOpen(true)}>
                        {t('profile.change_password')}
                    </button>
                </div>
            </div>

            {isModalOpen && (
                <ChangePasswordModal
                    passwordForm={passwordForm}
                    onChange={handlePasswordChange}
                    onSubmit={handlePasswordSubmit}
                    onClose={() => {
                        setIsModalOpen(false);
                        setPasswordForm({
                            currentPassword: '',
                            newPassword: '',
                            confirmPassword: ''
                        });
                        setErrors({});
                    }}
                    errors={errors}
                />
            )}
        </>
    );
};

export default ProfilePage;
