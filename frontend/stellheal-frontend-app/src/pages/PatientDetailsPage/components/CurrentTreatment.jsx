import React from 'react';
import DiagnosisCard from './DiagnosisCard';

const CurrentTreatment = ({ treatment, onDelete, role, patientId }) => (
    <div>
        {treatment.map((diagnosis, index) => (
            <DiagnosisCard
                key={index}
                diagnosis={diagnosis}
                isHistory={false}
                onDelete={onDelete}
                role={role}
                patientId={patientId}
            />
        ))}
    </div>
);

export default CurrentTreatment;