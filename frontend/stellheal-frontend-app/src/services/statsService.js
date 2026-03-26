import axios from '../utils/api';

export const fetchClinicStats = () => axios.get('/stats/clinic');

export const fetchDoctorStats = () => axios.get('/stats/doctors');
