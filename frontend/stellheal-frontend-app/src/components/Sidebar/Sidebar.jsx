import React from 'react';
import styles from './Sidebar.module.css';
import {
    FaUserMd,
    FaUserInjured,
    FaMicrochip,
    FaChartBar,
    FaSave,
    FaSignOutAlt
} from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import default_avatar from '../../assets/default_avatar.svg';

const Sidebar = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    const role = user?.role;
    const currentPath = location.pathname;

    const links = role === 'admin'
        ? [
            { key: 'profile', label: t('sidebar.profile'), icon: <FaUserMd /> },
            { key: 'staff', label: t('sidebar.staff'), icon: <FaUserMd /> },
            { key: 'patients', label: t('sidebar.patients'), icon: <FaUserInjured /> },
            { key: 'devices', label: t('sidebar.devices'), icon: <FaMicrochip /> },
            { key: 'stats', label: t('sidebar.stats'), icon: <FaChartBar /> },
            { key: 'backup', label: t('sidebar.backup'), icon: <FaSave /> }
        ]
        : [
            { key: 'profile', label: t('sidebar.profile'), icon: <FaUserMd /> },
            { key: 'patients', label: t('sidebar.patients'), icon: <FaUserInjured /> }
        ];

    return (
        <aside className={styles.sidebar}>
            <div className={styles.userInfo}>
                <img src={user?.avatar || default_avatar} alt="avatar" className={styles.avatar} />
                <p className={styles.name}>
                    {user?.lastName} {user?.firstName?.charAt(0)}.
                </p>
            </div>
            <nav className={styles.menu}>
                {links.map(link => {
                    const isActive = currentPath.includes(link.key);

                    return (
                        <div
                            key={link.key}
                            className={`${styles.menuItem} ${isActive ? styles.active : ''}`}
                            onClick={() => navigate(`/main/${link.key}`)}
                        >
                            {link.icon}
                            <span>{link.label}</span>
                        </div>
                    );
                })}
            </nav>

            <div className={styles.logout} onClick={() => {
                logout();
                navigate('/');
            }}>
                <FaSignOutAlt />
                <span>{t('sidebar.logout')}</span>
            </div>
        </aside>
    );
};

export default Sidebar;
