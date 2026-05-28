import axios from '../utils/api';

export const triggerManualBackup = () => axios.post('/backup/manual');

export const getBackupList    = ()     => axios.get('/backup/list');

export const restoreBackup    = (name) => axios.post('/backup/restore', { name });

export const deleteBackup     = (name) => axios.delete(`/backup/${encodeURIComponent(name)}`);
