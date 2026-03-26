import axios from '../utils/api';

export const getAllMedicalStaff = async () => {
    const res = await axios.get('/staff');
    return res.data;
};

export const addStaff = async (staffData) => {
    const response = await axios.post('/staff', {
        ...staffData,
        date_of_birth: staffData.date_of_birth || null,
    });
    return response.data;
};

export const getStaffCount = async () => {
    const res = await axios.get('/staff/count');
    return res.data.count;
};

export const getAllRoles = async () => {
    const res = await axios.get('/staff/roles');
    return res.data;
};

export const createRole = async (roleName) => {
    await axios.post('/staff/roles', { role_name: roleName });
};

export const deleteRole = async (roleId) => {
    await axios.delete(`/staff/roles/${roleId}`);
};

export const updateRole = async (id, roleName) => {
    const res = await axios.put(`/staff/roles/${id}`, { role_name: roleName });
    return res.data;
};

export const updateStaff = async (staffData) => {
    const response = await axios.put(`/staff/${staffData.user_id}`, staffData);
    return response.data;
};

export const exportStaffToExcel = async () => {
    const res = await axios.get('/staff/export', {
        responseType: 'blob', // ВАЖЛИВО: щоб отримати файл
    });

    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'staff_export.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
};

export const deleteStaff = async (userId) => {
    const res = await axios.delete(`/staff/${userId}`);
    return res.data;
};
