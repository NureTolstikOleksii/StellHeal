import axios from '../utils/api';

export const fetchContainerStats = () => axios.get('/containers/stats');

export const fetchLatestFillings = () => axios.get('/containers/fillings');

export const fetchTotalContainers = () => axios.get('/containers/count');

export const fetchAllContainers  = () => axios.get('/containers');

export const registerContainer   = (data) => axios.post('/containers', data);

export const deleteContainer = (id) => axios.delete(`/containers/${id}`);

export const fetchAdminCompartments = (id) => axios.get(`/containers/${id}/compartments/admin`);

export const fetchContainerEvents = (id) => axios.get(`/containers/${id}/events`);

export const fetchContainerSessions = (id) => axios.get(`/containers/${id}/sessions`);

export const exportContainers = () => axios.get('/containers/export', {
    responseType: 'blob'
});