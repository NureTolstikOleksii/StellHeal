import React from 'react';
import styles from './Sidebar.module.css';
import {
    FaUserMd, FaUserInjured, FaMicrochip,
    FaChartBar, FaSave, FaSignOutAlt, FaUser,
    FaHospital,
} from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import default_avatar from '../../assets/icons/default_avatar.svg';

const Sidebar = () => {
    const { t } = useTranslation();
    const navigate  = useNavigate();
    const location  = useLocation();
    const { user, logout } = useAuth();

    const role        = user?.role;
    const currentPath = location.pathname;

    const links = role === 'admin'
        ? [
            { key: 'profile',  label: t('sidebar.profile'),  icon: <FaUser size={15} />        },
            { key: 'staff',    label: t('sidebar.staff'),    icon: <FaUserMd size={15} />      },
            { key: 'patients', label: t('sidebar.patients'), icon: <FaUserInjured size={15} /> },
            { key: 'devices',  label: t('sidebar.devices'),  icon: <FaMicrochip size={15} />   },
            { key: 'wards',    label: t('sidebar.wards'),    icon: <FaHospital size={15} />    },
            { key: 'stats',    label: t('sidebar.stats'),    icon: <FaChartBar size={15} />    },
            { key: 'backup',   label: t('sidebar.backup'),   icon: <FaSave size={15} />        },
        ]
        : [
            { key: 'profile',  label: t('sidebar.profile'),  icon: <FaUser size={15} />        },
            { key: 'patients', label: t('sidebar.patients'), icon: <FaUserInjured size={15} /> },
        ];

    const handleLogout = () => {
        if (window.confirm(t('sidebar.logout') + '?')) logout();
    };

    const displayName = [user?.last_name, user?.first_name ? user.first_name.charAt(0) + '.' : '']
        .filter(Boolean).join(' ');

    return (
        <aside className={styles.sidebar}>

            <div className={styles.userBlock}>
                <div className={styles.avatarWrapper}>
                    <img
                        src={user?.avatar ? `${user.avatar}?t=${Date.now()}` : default_avatar}
                        alt="avatar"
                        className={styles.avatar}
                    />
                    <div className={styles.onlineDot} />
                </div>
                <div className={styles.userInfo}>
                    <span className={styles.userName}>{displayName || '—'}</span>
                    <span className={styles.userRole}>{role}</span>
                </div>
            </div>

            <div className={styles.divider} />

            <nav className={styles.menu}>
                {links.map(link => {
                    const isActive = currentPath.includes(link.key);
                    return (
                        <div
                            key={link.key}
                            className={`${styles.menuItem} ${isActive ? styles.menuItemActive : ''}`}
                            onClick={() => navigate(`/main/${link.key}`)}
                        >
                            <span className={`${styles.menuIcon} ${isActive ? styles.menuIconActive : ''}`}>
                                {link.icon}
                            </span>
                            <span className={styles.menuLabel}>{link.label}</span>
                            {isActive && <div className={styles.activeBar} />}
                        </div>
                    );
                })}
            </nav>

            <div className={styles.logoutBlock}>
                <div className={styles.divider} />
                <div className={styles.logout} onClick={handleLogout}>
                    <FaSignOutAlt size={15} />
                    <span>{t('sidebar.logout')}</span>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;