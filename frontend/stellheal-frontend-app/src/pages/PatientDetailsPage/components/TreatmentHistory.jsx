import React from 'react';
import DiagnosisCard from './DiagnosisCard';

const TreatmentHistory = ({ history, year, patientId }) => {
    const filtered = history.filter(item =>
        new Date(item.date).getFullYear() === Number(year)
    );
    if (filtered.length === 0) return <div>Немає лікувань за {year} рік</div>;
    return (
        <div>
            {filtered.map((item, index) => (
                <DiagnosisCard key={index} diagnosis={item} isHistory={true} patientId={patientId} />
            ))}
        </div>
    );
};

export default TreatmentHistory;