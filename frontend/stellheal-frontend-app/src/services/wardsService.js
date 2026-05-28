import axios from '../utils/api';

export const getAllWards      = ()        => axios.get('/wards/all');
export const getWardPatients = (id)      => axios.get(`/wards/${id}/patients`);
export const createWard      = (data)    => axios.post('/wards', data);
export const updateWard      = (id, data)=> axios.put(`/wards/${id}`, data);
export const blockWard       = (id)      => axios.patch(`/wards/${id}/block`);
export const unblockWard     = (id)      => axios.patch(`/wards/${id}/unblock`);
export const deleteWard      = (id)      => axios.delete(`/wards/${id}`);