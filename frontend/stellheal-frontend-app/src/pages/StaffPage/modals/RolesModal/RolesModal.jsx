import React, { useEffect, useState } from 'react';
import styles from './RolesModal.module.css';
import * as rolesService from '../../../../services/staffService.js';
import { FaTrashAlt, FaPlus, FaPen, FaCheck, FaTimes, FaShieldAlt } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import LoaderOverlay from '../../../../components/LoaderOverlay/LoaderOverlay.jsx';

const RolesModal = ({ onClose }) => {
    const { t } = useTranslation();
    const [roles, setRoles]               = useState([]);
    const [loading, setLoading]           = useState(true);
    const [newRole, setNewRole]           = useState('');
    const [newRoleError, setNewRoleError] = useState('');
    const [adding, setAdding]             = useState(false);
    const [editingId, setEditingId]       = useState(null);
    const [editName, setEditName]         = useState('');
    const [error, setError]               = useState('');

    useEffect(() => { fetchRoles(); }, []);

    const fetchRoles = async () => {
        setLoading(true);
        try {
            const data = await rolesService.getAllRoles();
            setRoles(data);
        } catch {
            setError(t('roles.error_loading'));
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newRole.trim()) { setNewRoleError(t('profile.required')); return; }
        setAdding(true);
        try {
            await rolesService.createRole(newRole.trim());
            setNewRole('');
            setNewRoleError('');
            await fetchRoles();
        } catch {
            setNewRoleError(t('roles.error_add'));
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (roleId) => {
        if (!window.confirm(t('roles.confirm_delete'))) return;
        try {
            await rolesService.deleteRole(roleId);
            await fetchRoles();
        } catch {
            setError(t('roles.error_delete'));
        }
    };

    const startEdit = (role) => {
        setEditingId(role.role_id);
        setEditName(role.role_name);
        setError('');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName('');
    };

    const saveEdit = async (roleId) => {
        if (!editName.trim()) return;
        try {
            await rolesService.updateRole(roleId, editName.trim());
            setEditingId(null);
            setEditName('');
            await fetchRoles();
        } catch {
            setError(t('roles.error_edit'));
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className={styles.modalHeader}>
                    <div className={styles.modalTitleRow}>
                        <FaShieldAlt className={styles.modalTitleIcon} />
                        <h3 className={styles.title}>{t('roles.title')}</h3>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <FaTimes size={15} />
                    </button>
                </div>

                {/* Error */}
                {error && <div className={styles.errorMsg}>{error}</div>}

                {/* Roles list */}
                {loading ? (
                    <div className={styles.loaderWrap}>
                        <LoaderOverlay inline />
                    </div>
                ) : (
                    <ul className={styles.list}>
                        {roles.length === 0 && (
                            <li className={styles.empty}>{t('roles.no_data') || 'Немає ролей'}</li>
                        )}
                        {roles.map(role => (
                            <li key={role.role_id} className={styles.item}>
                                {editingId === role.role_id ? (
                                    <div className={styles.editRow}>
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            className={styles.input}
                                            autoFocus
                                            onKeyDown={e => e.key === 'Enter' && saveEdit(role.role_id)}
                                        />
                                        <button className={styles.iconBtnGreen} onClick={() => saveEdit(role.role_id)} title={t('roles.save')}>
                                            <FaCheck size={13} />
                                        </button>
                                        <button className={styles.iconBtnGray} onClick={cancelEdit} title={t('common.cancel')}>
                                            <FaTimes size={13} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className={styles.itemRow}>
                                        <span className={styles.roleName}>{role.role_name}</span>
                                        <div className={styles.itemActions}>
                                            <button className={styles.iconBtnBlue} onClick={() => startEdit(role)} title={t('roles.edit')}>
                                                <FaPen size={12} />
                                            </button>
                                            <button className={styles.iconBtnRed} onClick={() => handleDelete(role.role_id)} title={t('roles.delete')}>
                                                <FaTrashAlt size={12} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                {/* Add new role */}
                <div className={styles.addBlock}>
                    <p className={styles.addLabel}>{t('roles.new')}</p>
                    <div className={styles.addRow}>
                        <input
                            type="text"
                            placeholder={t('roles.new') + '...'}
                            value={newRole}
                            onChange={e => { setNewRole(e.target.value); setNewRoleError(''); }}
                            className={`${styles.input} ${newRoleError ? styles.inputError : ''}`}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        />
                        <button className={styles.addBtn} onClick={handleAdd} disabled={adding}>
                            <FaPlus size={13} />
                            {adding ? '...' : t('roles.add')}
                        </button>
                    </div>
                    {newRoleError && <span className={styles.fieldError}>{newRoleError}</span>}
                </div>

                {/* Close */}
                <button className={styles.doneBtn} onClick={onClose}>
                    {t('roles.close')}
                </button>
            </div>
        </div>
    );
};

export default RolesModal;