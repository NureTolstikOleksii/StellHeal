import React, { useRef, useEffect, useState } from 'react';
import styles from './ProfilePage.module.css';
import { useTranslation } from 'react-i18next';
import { MdEdit } from 'react-icons/md';
import { FaUser, FaLock, FaSave } from 'react-icons/fa';
import {
    getProfile,
    uploadAvatar,
    changePassword,
    updateProfile
} from '../../services/profileService';
import { useAuth } from '../../context/AuthContext.jsx';
import ChangePasswordModal from './modals/ChangePasswordModal/ChangePasswordModal.jsx';
import defaultAvatar from '../../assets/icons/default_avatar.svg';
import LoaderOverlay from '../../components/LoaderOverlay/LoaderOverlay';

const ProfilePage = () => {
    const { user, setUser } = useAuth();
    const { t } = useTranslation();
    const fileInputRef = useRef(null);
    const [isModalOpen, setIsModalOpen]   = useState(false);
    const [profileData, setProfileData]   = useState(null);
    const [loading, setLoading]           = useState(true);
    const [errors, setErrors]             = useState({});
    const [saving, setSaving]             = useState(false);
    const isAdmin = user?.role === 'admin';
    const [avatarVersion, setAvatarVersion] = useState(Date.now());
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
            setProfileData(prev => ({ ...prev, avatar: newAvatar }));
            setAvatarVersion(Date.now());
            const updatedUser = { ...user, avatar: newAvatar };
            setUser(updatedUser);
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
        if (!newPassword)     newErrors.newPassword     = t('profile.required');
        if (newPassword !== confirmPassword) newErrors.confirmPassword = t('profile.passwords_do_not_match');
        if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

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
        setErrors(prev => { const u = { ...prev }; delete u[name]; delete u.general; return u; });
        setProfileData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        const requiredFields = ['first_name', 'last_name', 'patronymic', 'phone', 'email', 'contact_info'];
        const newErrors = {};
        requiredFields.forEach(field => {
            if (!profileData?.[field]?.trim()) newErrors[field] = t('profile.required');
        });
        if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

        setSaving(true);
        try {
            const updatedUser = await updateProfile({ ...profileData, login: profileData.email });
            const normalized = {
                ...user,
                avatar:       updatedUser.avatar,
                first_name:   updatedUser.first_name,
                last_name:    updatedUser.last_name,
                patronymic:   updatedUser.patronymic,
                phone:        updatedUser.phone,
                email:        updatedUser.email,
                contact_info: updatedUser.contact_info,
            };
            setUser(normalized);
            localStorage.setItem('user', JSON.stringify(normalized));
            setProfileData(prev => ({ ...prev, ...updatedUser, email: updatedUser.login ?? prev.email }));
            alert(t('profile.saved_successfully'));
            setErrors({});
        } catch (err) {
            console.error('Помилка при збереженні профілю:', err);
            setErrors({ general: err.response?.data?.error || t('profile.save_error') });
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        getProfile()
            .then(data => setProfileData({ ...data, email: data.login }))
            .catch(err => console.error('Помилка завантаження профілю:', err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <LoaderOverlay />;

    const FIELDS = [
        { name: 'last_name',   label: t('profile.last_name')   },
        { name: 'first_name',  label: t('profile.first_name')  },
        { name: 'patronymic',  label: t('profile.patronymic')  },
        { name: 'phone',       label: t('profile.phone')       },
        { name: 'email',       label: t('profile.email_field') },
    ];

    return (
        <div className={styles.pageWrapper}>
            <div className={styles.pageHeader}>
                <div className={styles.pageTitleRow}>
                    <h2 className={styles.pageTitle}>{t('profile.title')}</h2>
                </div>
            </div>

            <div className={styles.contentCard}>
                <div className={styles.formRow}>
                    <div className={styles.fields}>
                        {FIELDS.map(({ name, label }) => (
                            <div key={name} className={styles.inputGroup}>
                                <label className={styles.inputLabel}>{label}</label>
                                <input
                                    type={name === 'email' ? 'email' : 'text'}
                                    name={name}
                                    value={profileData?.[name] || ''}
                                    onChange={handleInputChange}
                                    readOnly={!isAdmin}
                                    className={`${styles.input} ${!isAdmin ? styles.inputDisabled : styles.inputEditable}`}
                                />
                                {errors[name] && <div className={styles.inputError}>{errors[name]}</div>}
                            </div>
                        ))}

                        <div className={styles.inputGroup}>
                            <label className={styles.inputLabel}>
                                {isAdmin
                                    ? `${t('profile.role')} ${t('profile.no-edit')}`
                                    : t('profile.specialization')}
                            </label>
                            <input
                                type="text"
                                readOnly
                                value={isAdmin ? t('profile.admin') : profileData?.medical_staff?.specialization || ''}
                                className={`${styles.input} ${styles.inputDisabled}`}
                            />
                        </div>

                        <div className={styles.inputGroupFull}>
                            <label className={styles.inputLabel}>{t('profile.address')}</label>
                            <input
                                type="text"
                                name="contact_info"
                                value={profileData?.contact_info || ''}
                                onChange={handleInputChange}
                                readOnly={!isAdmin}
                                className={`${styles.input} ${!isAdmin ? styles.inputDisabled : styles.inputEditable}`}
                            />
                            {errors.contact_info && <div className={styles.inputError}>{errors.contact_info}</div>}
                        </div>

                        {isAdmin && (
                            <div className={styles.inputGroupFull}>
                                {errors.general && (
                                    <div className={styles.formError}>{errors.general}</div>
                                )}
                                <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                                    <FaSave size={14} />
                                    {saving ? t('common.save') + '...' : t('profile.save_changes')}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className={styles.photoBlock}>
                        <div className={styles.avatarWrapper}>
                            <img
                                src={profileData?.avatar ? `${profileData.avatar}?v=${avatarVersion}` : defaultAvatar}
                                alt="avatar"
                                className={styles.avatar}
                            />
                            <button className={styles.editPhotoBtn} onClick={handleEditClick} title={t('profile.edit_photo')}>
                                <MdEdit size={16} />
                            </button>
                            <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                        </div>

                        <div className={styles.userNameBlock}>
                            <div className={styles.userName}>
                                {profileData?.last_name} {profileData?.first_name}
                            </div>
                            <div className={styles.userRole}>
                                {isAdmin ? t('profile.admin') : profileData?.medical_staff?.specialization || ''}
                            </div>
                        </div>

                        <button className={styles.passwordBtn} onClick={() => setIsModalOpen(true)}>
                            <FaLock size={13} /> {t('profile.change_password')}
                        </button>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <ChangePasswordModal
                    passwordForm={passwordForm}
                    onChange={handlePasswordChange}
                    onSubmit={handlePasswordSubmit}
                    onClose={() => {
                        setIsModalOpen(false);
                        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        setErrors({});
                    }}
                    errors={errors}
                />
            )}
        </div>
    );
};

export default ProfilePage;