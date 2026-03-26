import axios from 'axios';

const instance = axios.create({
    baseURL: 'https://stellhealback-production.up.railway.app',
    //baseURL: 'http://localhost:4200',
});

instance.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default instance;
