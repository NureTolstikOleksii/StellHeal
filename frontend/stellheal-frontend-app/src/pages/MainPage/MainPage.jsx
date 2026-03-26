import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import styles from './MainPage.module.css';
import Header from '../../components/Header/Header';
import Sidebar from '../../components/Sidebar/Sidebar';
import { useAuth } from '../../context/AuthContext';

const MainPage = () => {
    const { user } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <>
            <Header role={user.role} onToggleMenu={() => setMenuOpen(prev => !prev)} />
            <div className={styles.wrapper}>
                <div className={`${styles.sidebarWrapper} ${menuOpen ? styles.open : ''}`}>
                    <Sidebar role={user.role} user={user} />
                </div>
                <main className={styles.mainContent} onClick={() => setMenuOpen(false)}>
                    <Outlet />
                </main>
            </div>
        </>
    );
};

export default MainPage;
