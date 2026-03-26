import axios from '../utils/api';

export const getLastBackupTime = () => axios.get('/backup/last');

export const triggerManualBackup = () => axios.post('/backup/manual');
