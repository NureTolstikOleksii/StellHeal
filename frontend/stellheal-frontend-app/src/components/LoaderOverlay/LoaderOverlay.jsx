import React from 'react';
import styles from './LoaderOverlay.module.css';

const LoaderOverlay = () => {
    return (
        <div className={styles.overlay}>
            <div className={styles.cubeContainer}>
                <div className={styles.cube}></div>
                <div className={styles.cube}></div>
                <div className={styles.cube}></div>
            </div>
        </div>
    );
};

export default LoaderOverlay;
