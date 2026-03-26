import React, { forwardRef } from 'react';
import { FaRegCalendarAlt } from 'react-icons/fa';
import styles from '../Patients/AddPatientModal.module.css';

const CustomDateInput = forwardRef(({ value, onClick, placeholder }, ref) => (
    <div className={styles.inputWithIcon} onClick={onClick} ref={ref}>
        <input
            className={styles.dateInput}
            value={value}
            onChange={() => {}}
            placeholder={placeholder}
            readOnly
        />
        <FaRegCalendarAlt className={styles.calendarIcon} />
    </div>
));

export default CustomDateInput;
