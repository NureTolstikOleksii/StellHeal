import React from 'react';
import DiagnosisCard from './DiagnosisCard';

const TreatmentHistory = ({ history, year }) => {
    const filtered = history.filter(item => {
        const treatmentYear = new Date(item.date).getFullYear();
        return treatmentYear === Number(year);
    });

    if (filtered.length === 0) {
        return <div>Немає лікувань за {year} рік</div>;
    }

    return (
        <div>
            {filtered.map((item, index) => (
                <DiagnosisCard key={index} diagnosis={item} isHistory={true} />
            ))}
        </div>
    );
};

export default TreatmentHistory;
