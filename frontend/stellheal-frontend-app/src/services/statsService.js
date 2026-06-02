import axios from '../utils/api';

export const fetchClinicStats = () => axios.get('/stats/clinic');

export const fetchDoctorStats = () => axios.get('/stats/doctors');

export const fetchIntakeStats = (weekOffset = 0) => axios.get(`/stats/intake-week?weekOffset=${weekOffset}`);

export const fetchAuditLog     = (params) => axios.get('/stats/audit-log', { params })

export const fetchAuditActions = ()       => axios.get('/stats/audit-actions');

