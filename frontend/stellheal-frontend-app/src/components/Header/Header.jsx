import React, { useState, useRef, useEffect } from 'react';
import styles from './Header.module.css';
import logo from '../../assets/logo.png';
import flagUk from '../../assets/icons/flag-uk.png';
import flagEn from '../../assets/icons/flag-en.png';
import i18n from '../../i18n';
import { FaBars, FaChevronDown } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import LoaderOverlay from '../LoaderOverlay/LoaderOverlay.jsx';

const LANGS = [
    { code: 'uk', flag: flagUk, alt: 'UA' },
    { code: 'en', flag: flagEn, alt: 'EN' },
];

const Header = ({ role, onToggleMenu }) => {
    const { t, i18n: i18nHook } = useTranslation();

    const currentLang = i18nHook.language?.substring(0, 2) || 'en';
    const currentLangData = LANGS.find(l => l.code === currentLang) || LANGS[1];

    const [open, setOpen]                 = useState(false);
    const [showPageLoader, setShowPageLoader] = useState(false);
    const switchRef = useRef(null);

    const handleSelect = (lang) => {
        if (lang === currentLang) { setOpen(false); return; }
        setShowPageLoader(true);
        setTimeout(() => {
            i18n.changeLanguage(lang);
            setShowPageLoader(false);
            setOpen(false);
        }, 400);
    };

    useEffect(() => {
        const handler = (e) => {
            if (switchRef.current && !switchRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <>
            <header className={styles.header}>
                <div className={styles.container}>

                    {/* Burger */}
                    <button className={styles.menuToggle} onClick={onToggleMenu} aria-label="Menu">
                        <FaBars size={18} />
                    </button>

                    {/* Logo */}
                    <div className={styles.logoBlock}>
                        <img src={logo} alt="StellHeal" className={styles.logo} />
                        <div className={styles.titleBlock}>
                            <span className={styles.title}>StellHeal</span>
                            {role === 'admin'  && <span className={styles.subtitle}>admin-panel</span>}
                            {role === 'doctor' && <span className={styles.subtitle}>doctor-panel</span>}
                        </div>
                    </div>

                    {/* Right side */}
                    <div className={styles.rightSide}>
                        <div
                            ref={switchRef}
                            className={styles.languageSwitch}
                            onClick={() => setOpen(prev => !prev)}
                        >
                            <img
                                src={currentLangData.flag}
                                alt={currentLangData.alt}
                                className={styles.flagIcon}
                            />
                            <span className={styles.langLabel}>
                                {t(`language.${currentLang}`)}
                            </span>
                            <FaChevronDown
                                size={11}
                                className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
                            />

                            {open && (
                                <div className={styles.dropdown}>
                                    {LANGS.map(({ code, flag, alt }) => (
                                        <div
                                            key={code}
                                            className={`${styles.langItem} ${currentLang === code ? styles.langItemActive : ''}`}
                                            onClick={() => handleSelect(code)}
                                        >
                                            <img src={flag} alt={alt} className={styles.dropFlagIcon} />
                                            <span>{t(`language.${code}`)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {showPageLoader && <LoaderOverlay />}
        </>
    );
};

export default Header;