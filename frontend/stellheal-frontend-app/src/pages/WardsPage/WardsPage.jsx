import React, { useEffect, useState } from 'react';
import styles from './WardsPage.module.css';
import { useTranslation } from 'react-i18next';
import {
    FaHospital, FaPlus, FaTimes, FaEdit, FaTrashAlt,
    FaUserInjured, FaCheckCircle, FaExclamationTriangle, FaBan,
} from 'react-icons/fa';
import LoaderOverlay from '../../components/LoaderOverlay/LoaderOverlay';
import Toast from '../../components/Toast/Toast';
import * as wardsService from '../../services/wardsService';
import WardPatientsModal from './modals/WardPatientsModal/WardPatientsModal.jsx';


const Field = ({ name, label, type = 'text', placeholder, value, error, onChange }) => (
    <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>{label}</label>
        <input
            type={type}
            className={`${styles.input} ${error ? styles.inputError : ''}`}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
        />
        {error && <span className={styles.fieldError}>{error}</span>}
    </div>
);


const WardModal = ({ ward, onClose, onSave }) => {
    const { t } = useTranslation();
    const [form, setForm]     = useState({
        ward_number: ward?.ward_number || '',
        capacity:    ward?.capacity    || '',
    });
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const validate = () => {
        const e = {};
        if (!form.ward_number.trim()) e.ward_number = t('profile.required');
        if (form.capacity && (isNaN(form.capacity) || Number(form.capacity) < 1))
            e.capacity = t('wards.capacity_error') || 'Введіть число більше 0';
        return e;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }
        setSaving(true);
        try {
            await onSave({
                ward_number: form.ward_number.trim(),
                capacity:    form.capacity ? Number(form.capacity) : null,
            });
            onClose();
        } catch (err) {
            setErrors({ general: err.response?.data?.message || t('wards.save_error') });
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (name) => (e) => {
        setForm(p => ({ ...p, [name]: e.target.value }));
        setErrors(p => ({ ...p, [name]: '' }));
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <div className={styles.modalTitleRow}>
                        <FaHospital className={styles.modalTitleIcon} />
                        <h3 className={styles.modalTitle}>
                            {ward ? t('wards.edit_title') : t('wards.add_title')}
                        </h3>
                    </div>
                    <button className={styles.modalCloseBtn} onClick={onClose}>
                        <FaTimes size={15} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} noValidate className={styles.modalForm}>
                    <Field
                        name="ward_number"
                        label={t('wards.ward_number')}
                        placeholder={t('wards.ward_number_placeholder') || 'напр. 101'}
                        value={form.ward_number}
                        error={errors.ward_number}
                        onChange={handleChange('ward_number')}
                    />
                    <Field
                        name="capacity"
                        label={t('wards.capacity')}
                        type="number"
                        placeholder={t('wards.capacity_placeholder') || 'напр. 4'}
                        value={form.capacity}
                        error={errors.capacity}
                        onChange={handleChange('capacity')}
                    />
                    {errors.general && (
                        <div className={styles.generalError}>{errors.general}</div>
                    )}
                    <div className={styles.modalActions}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>
                            {t('common.cancel')}
                        </button>
                        <button type="submit" className={styles.submitBtn} disabled={saving}>
                            {saving ? '...' : t('common.save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const WardCard = ({ ward, onView, onEdit, onDelete, t }) => {
    const occupancy = ward.capacity ? Math.round((ward.active_patients / ward.capacity) * 100) : 0;
    const barColor  = occupancy >= 100 ? '#ef4444' : occupancy >= 75 ? '#f59e0b' : '#22c55e';

    return (
        <div
            className={`${styles.wardCard} ${ward.is_full ? styles.wardFull : ''} ${ward.is_blocked ? styles.wardBlocked : ''}`}
            onClick={() => onView(ward)}
            style={{ cursor: 'pointer' }}
        >
            <div className={styles.wardTop}>
                <div className={styles.wardInfo}>
                    <div className={styles.wardNumber}>
                        {t('wards.ward')} {ward.ward_number}
                    </div>
                    <div className={styles.wardBadges}>
                        {ward.is_blocked && (
                            <span className={styles.blockedBadge}>
                                <FaBan size={9} /> {t('wards.blocked') || 'Заблоковано'}
                            </span>
                        )}
                        {!ward.is_blocked && ward.is_full && (
                            <span className={styles.fullBadge}>
                                <FaExclamationTriangle size={9} /> {t('wards.full')}
                            </span>
                        )}
                        {!ward.is_blocked && !ward.is_full && ward.active_patients === 0 && (
                            <span className={styles.freeBadge}>
                                <FaCheckCircle size={9} /> {t('wards.free')}
                            </span>
                        )}
                    </div>
                </div>
                <div className={styles.wardActions}>
                    <button className={styles.editBtn} onClick={e => { e.stopPropagation(); onEdit(ward); }}>
                        <FaEdit size={13} />
                    </button>
                    <button className={styles.deleteBtn} onClick={e => { e.stopPropagation(); onDelete(ward); }}>
                        <FaTrashAlt size={13} />
                    </button>
                </div>
            </div>

            <div className={styles.wardStats}>
                <div className={styles.wardStat}>
                    <FaUserInjured size={12} className={styles.wardStatIcon} />
                    <span>{ward.active_patients} / {ward.capacity ?? '—'}</span>
                </div>
            </div>

            {ward.capacity > 0 && (
                <div className={styles.wardOccupancy}>
                    <div className={styles.occupancyBar}>
                        <div
                            className={styles.occupancyFill}
                            style={{
                                width: `${Math.min(occupancy, 100)}%`,
                                background: ward.is_blocked ? '#d1d5db' : barColor,
                            }}
                        />
                    </div>
                    <span className={styles.occupancyLabel}>{occupancy}%</span>
                </div>
            )}
        </div>
    );
};

const WardsPage = () => {
    const { t } = useTranslation();

    const [wards, setWards]           = useState([]);
    const [loading, setLoading]       = useState(true);
    const [modalOpen, setModalOpen]   = useState(false);
    const [editWard, setEditWard]     = useState(null);
    const [viewWard, setViewWard]     = useState(null);
    const [toast, setToast] = useState({ open: false, type: 'success', title: '', message: '' });

    const showToast = (type, title, message = '') =>
        setToast({ open: true, type, title, message });

    const loadWards = async () => {
        setLoading(true);
        try {
            const res = await wardsService.getAllWards();
            setWards(res.data || []);
        } catch {
            showToast('error', t('wards.load_error'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadWards(); }, []);

    const handleAdd  = () => { setEditWard(null); setModalOpen(true); };
    const handleEdit = (ward) => { setEditWard(ward); setModalOpen(true); };

    const handleSave = async (data) => {
        if (editWard) {
            await wardsService.updateWard(editWard.ward_id, data);
            showToast('success', t('wards.updated'));
        } else {
            await wardsService.createWard(data);
            showToast('success', t('wards.created'));
        }
        await loadWards();
    };

    const handleDelete = async (ward) => {
        if (ward.active_patients > 0) {
            showToast('error',
                t('wards.delete_occupied_error') || 'Неможливо видалити',
                `${t('wards.delete_occupied_hint') || 'В палаті'} ${ward.active_patients} пацієнтів`
            );
            return;
        }
        if (!window.confirm(`${t('wards.delete_confirm')} №${ward.ward_number}?`)) return;
        try {
            await wardsService.deleteWard(ward.ward_id);
            await loadWards();
            showToast('success', t('wards.deleted'));
        } catch (err) {
            showToast('error', t('wards.delete_error'), err.response?.data?.message || '');
        }
    };

    const totalCapacity = wards.reduce((s, w) => s + (w.capacity || 0), 0);
    const totalPatients = wards.reduce((s, w) => s + w.active_patients, 0);
    const freeWards     = wards.filter(w => !w.is_full && !w.is_blocked).length;
    const blockedWards  = wards.filter(w => w.is_blocked).length;

    if (loading) return <LoaderOverlay />;

    return (
        <div className={styles.pageWrapper}>

            <div className={styles.pageHeader}>
                <div className={styles.titleBlock}>
                    <div className={styles.pageTitleRow}>
                        <h2 className={styles.pageTitle}>{t('wards.title')}</h2>
                    </div>
                    <div className={styles.counts}>
                        <div className={styles.countItem}>
                            <div className={styles.countValue}>{wards.length}</div>
                            <div className={styles.countLabel}>{t('wards.total')}</div>
                        </div>
                        <div className={styles.divider} />
                        <div className={styles.countItem}>
                            <div className={styles.countValue} style={{ color: '#22c55e' }}>{freeWards}</div>
                            <div className={styles.countLabel}>{t('wards.available')}</div>
                        </div>
                        <div className={styles.divider} />
                        <div className={styles.countItem}>
                            <div className={styles.countValue} style={{ color: '#1976d2' }}>{totalPatients}</div>
                            <div className={styles.countLabel}>{t('wards.occupied_patients')}</div>
                        </div>
                        <div className={styles.divider} />
                        <div className={styles.countItem}>
                            <div className={styles.countValue}>{totalCapacity}</div>
                            <div className={styles.countLabel}>{t('wards.total_capacity')}</div>
                        </div>
                        {blockedWards > 0 && (
                            <>
                                <div className={styles.divider} />
                                <div className={styles.countItem}>
                                    <div className={styles.countValue} style={{ color: '#ef4444' }}>{blockedWards}</div>
                                    <div className={styles.countLabel}>{t('wards.blocked_count') || 'Заблоковано'}</div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <button className={styles.addBtn} onClick={handleAdd}>
                    <FaPlus size={13} /> {t('wards.add')}
                </button>
            </div>

            {wards.length === 0 ? (
                <div className={styles.empty}>
                    <FaHospital size={36} color="#d1d5db" />
                    <p>{t('wards.empty')}</p>
                    <button className={styles.addBtn} onClick={handleAdd}>
                        <FaPlus size={13} /> {t('wards.add')}
                    </button>
                </div>
            ) : (
                <div className={styles.wardsGrid}>
                    {wards.map(ward => (
                        <WardCard
                            key={ward.ward_id}
                            ward={ward}
                            onView={() => setViewWard(ward)}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            t={t}
                        />
                    ))}
                </div>
            )}

            {modalOpen && (
                <WardModal
                    ward={editWard}
                    onClose={() => setModalOpen(false)}
                    onSave={handleSave}
                />
            )}

            {viewWard && (
                <WardPatientsModal
                    ward={viewWard}
                    onClose={() => setViewWard(null)}
                    onBlockToggle={() => loadWards()}
                />
            )}

            <Toast
                open={toast.open}
                type={toast.type}
                title={toast.title}
                message={toast.message}
                onClose={() => setToast(p => ({ ...p, open: false }))}
            />
        </div>
    );
};

export default WardsPage;