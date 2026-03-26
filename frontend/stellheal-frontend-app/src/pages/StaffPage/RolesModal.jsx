import React, { useEffect, useState } from 'react';
import styles from './RolesModal.module.css';
import * as rolesService from '../../services/staffService';
import { FaTrashAlt, FaPlus, FaPen } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const RolesModal = ({ onClose }) => {
    const { t } = useTranslation();
    const [roles, setRoles] = useState([]);
    const [newRole, setNewRole] = useState('');
    const [loading, setLoading] = useState(false);
    const [editingRoleId, setEditingRoleId] = useState(null);
    const [editRoleName, setEditRoleName] = useState('');

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        setLoading(true);
        try {
            const data = await rolesService.getAllRoles();
            setRoles(data);
        } catch (err) {
            console.error(t('roles.error_loading'), err);
        }
        setLoading(false);
    };

    const handleAddRole = async () => {
        if (newRole.trim()) {
            try {
                await rolesService.createRole(newRole);
                setNewRole('');
                fetchRoles();
            } catch (err) {
                alert(t('roles.error_add'));
            }
        }
    };

    const handleDelete = async (roleId) => {
        if (window.confirm(t('roles.confirm_delete'))) {
            try {
                await rolesService.deleteRole(roleId);
                fetchRoles();
            } catch (err) {
                alert(t('roles.error_delete'));
            }
        }
    };

    const startEdit = (role) => {
        setEditingRoleId(role.role_id);
        setEditRoleName(role.role_name);
    };

    const saveEdit = async (roleId) => {
        if (editRoleName.trim()) {
            try {
                await rolesService.updateRole(roleId, editRoleName);
                setEditingRoleId(null);
                setEditRoleName('');
                fetchRoles();
            } catch (err) {
                alert(t('roles.error_edit'));
            }
        }
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <h3 className={styles.title}>{t('roles.title')}</h3>

                {loading ? (
                    <p>{t('roles.loading')}</p>
                ) : (
                    <ul className={styles.rolesList}>
                        {roles.map((role) => (
                            <li key={role.role_id} className={styles.roleItem}>
                                <div className={styles.roleContent}>
                                    {editingRoleId === role.role_id ? (
                                        <>
                                            <input
                                                type="text"
                                                value={editRoleName}
                                                onChange={(e) => setEditRoleName(e.target.value)}
                                                className={styles.input}
                                            />
                                            <button onClick={() => saveEdit(role.role_id)} className={styles.saveButton}>
                                                {t('roles.save')}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <span>{role.role_name}</span>
                                            <div className={styles.actions}>
                                                <button onClick={() => startEdit(role)} className={styles.editButton} title={t('roles.edit')}>
                                                    <FaPen />
                                                </button>
                                                <button onClick={() => handleDelete(role.role_id)} className={styles.deleteButton} title={t('roles.delete')}>
                                                    <FaTrashAlt />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <div className={styles.addRoleForm}>
                    <input
                        type="text"
                        placeholder={t('roles.new')}
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className={styles.input}
                    />
                    <button onClick={handleAddRole} className={styles.addButton} title={t('roles.add')}>
                        <FaPlus className={styles.icon} /> {t('roles.add')}
                    </button>
                </div>

                <button onClick={onClose} className={styles.closeButton}>{t('roles.close')}</button>
            </div>
        </div>
    );
};

export default RolesModal;
