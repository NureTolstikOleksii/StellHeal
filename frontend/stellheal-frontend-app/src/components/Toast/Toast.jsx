import { useEffect, useRef, useState } from "react";
import styles from "./Toast.module.css";

import checkIcon from "../../assets/icons/check-circle.svg";
import errorIcon from "../../assets/icons/error-circle.svg";
import infoIcon from "../../assets/icons/info-circle.svg";
import closeIcon from "../../assets/icons/close.svg";

function Toast({
                   open,
                   type = "success",
                   title = "Success",
                   message = "",
                   autoCloseMs = 4500,
                   showDelayMs = 200,
                   onClose,
               }) {
    const [visible, setVisible] = useState(false);

    const hideTimeoutRef = useRef(null);
    const showTimeoutRef = useRef(null);
    const clearTimeoutRef = useRef(null);

    const icons = {
        success: checkIcon,
        error: errorIcon,
        info: infoIcon,
    };

    useEffect(() => {
        return () => {
            if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
            if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (!open) {
            setVisible(false);
            return;
        }

        showTimeoutRef.current = setTimeout(() => setVisible(true), showDelayMs);

        hideTimeoutRef.current = setTimeout(() => {
            setVisible(false);
            clearTimeoutRef.current = setTimeout(() => onClose?.(), 500);
        }, autoCloseMs);

        return () => {
            if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
            if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
        };
    }, [open, autoCloseMs, showDelayMs, onClose]);

    if (!open) return null;

    return (
        <div
            className={`
        ${styles.toast}
        ${styles[type]}
        ${visible ? styles.show : ""}
      `}
            role="status"
            aria-live="polite"
        >
            <div className={styles.icon}>
                <img src={icons[type] || infoIcon} alt="" />
            </div>

            <div className={styles.text}>
                <div className={styles.title}>{title}</div>
                <div className={styles.message}>{message}</div>
            </div>

            <button
                className={styles.close}
                type="button"
                onClick={() => {
                    setVisible(false);
                    setTimeout(() => onClose?.(), 250);
                }}
            >
                <img src={closeIcon} alt="" />
            </button>
        </div>
    );
}

export default Toast;