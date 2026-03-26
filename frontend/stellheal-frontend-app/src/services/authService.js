import axios from '../utils/api';

export const loginUser = async (email, password) => {
    const res = await axios.post('/login/web', { email, password });
    return res.data;
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
