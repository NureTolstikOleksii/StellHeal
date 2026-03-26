import axios from '../utils/api';

export const getProfile = async () => {
    const response = await axios.get('/profile');
    return response.data;
};

export const changePassword = async ({ currentPassword, newPassword }) => {
    const res = await axios.put('/profile/change-password', {
        currentPassword,
        newPassword
    });
    return res.data;
};

export const uploadAvatar = async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await axios.put('/profile/avatar', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return response.data;
};

export const updateProfile = async (profileData) => {
    const response = await axios.patch('/profile', {
        last_name: profileData.last_name,
        first_name: profileData.first_name,
        patronymic: profileData.patronymic,
        phone: profileData.phone,
        login: profileData.login,
        contact_info: profileData.contact_info
    });
    return response.data;
};
