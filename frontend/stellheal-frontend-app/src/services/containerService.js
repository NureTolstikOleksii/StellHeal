import axios from '../utils/api';

export const fetchContainerStats = () => axios.get('/containers/stats');

export const fetchLatestFillings = () => axios.get('/containers/fillings');

export const fetchTotalContainers = () => axios.get('/containers/count');

export const exportContainers = () => axios.get('/containers/export', {
    responseType: 'blob'
});