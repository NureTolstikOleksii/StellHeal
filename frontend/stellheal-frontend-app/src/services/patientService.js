import axios from '../utils/api';

export const fetchPatients = async () => {
    const res = await axios.get('/patients');
    return res.data;
};

export const fetchPatientsStats = async () => {
    const res = await axios.get('/patients/stats');
    return res.data;
};

export const createPatient = async (patientData) => {
    const res = await axios.post('/patients/create', patientData);
    return res.data;
};

export const downloadPatientsExcel = async () => {
    try {
        const response = await axios.get('/patients/export', {
            responseType: 'blob'
        });

        const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'patients.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (error) {
        console.error('Помилка експорту:', error);
    }
};

export const getPatientById = async (id) => {
    const res = await axios.get(`/patients/${id}`);
    return res.data;
};

export const getCurrentTreatment = async (patientId) => {
    const res = await axios.get(`/patients/${patientId}/current`);
    return res.data;
};

export const getTreatmentHistory = async (patientId) => {
    const res = await axios.get(`/patients/${patientId}/history`);
    return res.data;
};

// export const createPrescription = async (patientId, prescriptionData) => {
//     const token = localStorage.getItem('token');
//     const res = await axios.post(
//         `/patients/prescriptions/create`,
//         { patientId, ...prescriptionData },
//         { headers: { Authorization: `Bearer ${token}` } }
//     );
//     return res.data;
// };

export const createPrescription = async (patientId, formData) => {
    const response = await axios.post(
        '/patients/prescriptions/create',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
};

export const streamAiRecommendation = async (type, payload, onChunk, signal) => {
    const token = localStorage.getItem('accessToken');
    const baseURL = axios.defaults.baseURL; // http://localhost:4200/api

    const response = await fetch(`${baseURL}/ai/recommend`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ type, payload }),
        signal,
    });

    if (!response.ok) throw new Error(`AI error: ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') return;
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.text) onChunk(parsed.text);
                } catch {}
            }
        }
    }
};

// export const fetchMedications = async () => {
//     const res = await axios.get('/medication');
//     return res.data;
// };

export const fetchAvailableWards = async () => {
    const res = await axios.get('/wards');
    return res.data;
};

export const deletePrescription = async (prescriptionId) => {
    const token = localStorage.getItem('token');

    const res = await axios.delete(`/patients/prescriptions/${prescriptionId}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    return res.data;
};

export const downloadPatientReport = async (patientId) => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`/patients/${patientId}/report`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'blob'
        });

        const blob = new Blob([response.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `treatment-report-${patientId}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (error) {
        console.error('Response error:', error.response?.status, error.response?.data);
        console.error('Помилка завантаження звіту:', error);
        alert('Не вдалося завантажити звіт');
    }
};


export const deletePatient = async (id) => {
    const token = localStorage.getItem('token');
    const res = await axios.delete(`/patients/${id}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    return res.data;
};

export const updatePatient = async (id, patientData) => {
    const token = localStorage.getItem('token');
    const res = await axios.put(`/patients/${id}`, patientData, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    return res.data;
};

export const getPrescriptionFiles = async (patientId, prescriptionId) => {
    const res = await axios.get(`/patients/${patientId}/prescriptions/${prescriptionId}/files`);
    return res.data;
};

export const getAllPatientFiles = async (patientId) => {
    const res = await axios.get(`/patients/${patientId}/files`);
    return res.data;
};

export const getPrescriptionById = async (prescriptionId) => {
    const res = await axios.get(`/patients/prescriptions/${prescriptionId}`);
    return res.data;
};

export const updatePrescription = async (prescriptionId, formData) => {
    const res = await axios.put(
        `/patients/prescriptions/${prescriptionId}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data;
};

export const getIntakeStats = async (patientId, date, prescriptionId) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (prescriptionId) params.append('prescriptionId', prescriptionId);
    const res = await axios.get(`/patients/${patientId}/intake?${params}`);
    return res.data;
};

export const searchICDCodes = async (query) => {
    const res = await axios.get(`/icd/search?q=${encodeURIComponent(query)}`);
    return res.data;
};
