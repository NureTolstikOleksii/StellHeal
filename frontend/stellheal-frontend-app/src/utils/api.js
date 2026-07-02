import axios from "axios";
import {refreshTokenRequest} from "../services/authService.js";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL
        || 'https://stellheal-backend-f9e5azcyamhmg8b6.northeurope-01.azurewebsites.net/api',
});

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
    refreshSubscribers.push(cb);
};

const onRefreshed = (newToken) => {
    refreshSubscribers.forEach((cb) => cb(newToken));
    refreshSubscribers = [];
};

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const isAuthEndpoint = originalRequest.url.includes('/auth/');
        const refreshToken = localStorage.getItem('refreshToken');

        if (
            (error.response?.status === 401 || error.response?.status === 403) &&
            !originalRequest._retry &&
            !isAuthEndpoint &&
            refreshToken
        ) {
            originalRequest._retry = true;

            if (isRefreshing) {
                return new Promise((resolve) => {
                    subscribeTokenRefresh((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        resolve(api(originalRequest));
                    });
                });
            }

            isRefreshing = true;

            try {
                const res = await refreshTokenRequest(refreshToken);

                const newAccessToken = res.data.accessToken;
                const newRefreshToken = res.data.refreshToken;

                localStorage.setItem('accessToken', newAccessToken);
                localStorage.setItem('refreshToken', newRefreshToken);

                api.defaults.headers.Authorization = `Bearer ${newAccessToken}`;
                onRefreshed(newAccessToken);
                isRefreshing = false;

                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return api(originalRequest);

            } catch (err) {
                isRefreshing = false;
                localStorage.clear();
                window.location.href = '/';
                return Promise.reject(err);
            }
        }

        return Promise.reject(error);
    }
);

export default api;