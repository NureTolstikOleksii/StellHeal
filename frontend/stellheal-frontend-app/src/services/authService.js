import axios from '../utils/api';

export const loginUser = async (email, password) => {
    const res = await axios.post('/auth/login', {
        email,
        password,
        platform: 'web'
    });
    return res.data;
};

export const refreshTokenRequest = async (refreshToken) => {
    return await axios.post('/auth/refresh', { refreshToken });
};

export const sendResetEmail = async (email) => {
    return await axios.post('/login/forgot-password', { email });
};

export const resetPassword = async (token, newPassword) => {
    return await axios.post('/login/reset-password', {
        token,
        newPassword
    });
};
