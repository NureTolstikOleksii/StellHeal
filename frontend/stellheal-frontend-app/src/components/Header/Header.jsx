import React, { useState, useRef, useEffect } from 'react';
import styles from './Header.module.css';
import logo from '../../assets/logo.png';
import flagUk from '../../assets/flag-uk.png';
import flagEn from '../../assets/flag-en.png';
import i18n from '../../i18n';
import { FaBars } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import LoaderOverlay from "../LoaderOverlay/LoaderOverlay.jsx";

const Header = ({ role, onToggleMenu }) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [selectedLang, setSelectedLang] = useState(i18n.language || 'en');
    const switchRef = useRef(null);
    const [showPageLoader, setShowPageLoader] = useState(false);

    const toggleDropdown = () => setOpen((prev) => !prev);

    const getFlag = (lang) => {
        switch (lang) {
            case 'uk':
                return flagUk;
            case 'en':
            default:
                return flagEn;
        }
    };

    const handleSelect = (lang) => {
        setShowPageLoader(true);
        setTimeout(() => {
            i18n.changeLanguage(lang);
            setSelectedLang(lang);
            setShowPageLoader(false);
            setOpen(false);
        }, 600);
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (switchRef.current && !switchRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className={styles.header}>
            <div className={styles.container}>
                <button className={styles.menuToggle} onClick={onToggleMenu}>
                    <FaBars />
                </button>

                <div className={styles.leftSide}>
                    <div className={styles.logoBlock}>
                        <img src={logo} alt="Healthy Helper" className={styles.logo} />
                        <div className={styles.titleBlock}>
                            <h1 className={styles.title}>Healthy Helper</h1>
                            {role === 'admin' && <span className={styles.subtitle}>admin-panel</span>}
                            {role === 'doctor' && <span className={styles.subtitle}>doctor-panel</span>}
                        </div>
                    </div>
                </div>

                <div className={styles.rightSide}>
                    <div ref={switchRef} className={styles.languageSwitch} onClick={toggleDropdown}>
                        <img src={getFlag(selectedLang)} alt={selectedLang} className={styles.flagIcon} />
                        <span>{t(`language.${selectedLang}`)}</span>

                        {open && (
                            <div className={styles.dropdown}>
                                <div className={styles.langItem} onClick={() => handleSelect('uk')}>
                                    <img src={flagUk} alt="UA" />
                                    <span>{t('language.uk')}</span>
                                </div>
                                <div className={styles.langItem} onClick={() => handleSelect('en')}>
                                    <img src={flagEn} alt="EN" />
                                    <span>{t('language.en')}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {showPageLoader && <LoaderOverlay />}
        </header>
    );
};

export default Header;
