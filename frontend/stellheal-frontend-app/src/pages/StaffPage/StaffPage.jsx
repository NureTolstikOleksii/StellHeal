import React, { useEffect, useState } from 'react';
import styles from './StaffPage.module.css';
import StaffHeader from './components/StaffHeader.jsx';
import StaffFilters from './components/StaffFilters.jsx';
import StaffSearchBar from './components/StaffSearchBar.jsx';
import StaffTable from './components/StaffTable.jsx';
import AddStaffModal from './modals/AddEditStaffModal/AddStaffModal.jsx';
import RolesModal from './modals/RolesModal/RolesModal.jsx';
import EditStaffModal from './modals/AddEditStaffModal/EditStaffModal.jsx';
import * as staffService from '../../services/staffService';
import { useTranslation } from 'react-i18next';
import LoaderOverlay from '../../components/LoaderOverlay/LoaderOverlay';
import Toast from '../../components/Toast/Toast';

const StaffPage = () => {
    const { t } = useTranslation();

    const [isModalOpen, setIsModalOpen]               = useState(false);
    const [staffList, setStaffList]                   = useState([]);
    const [loading, setLoading]                       = useState(true);
    const [searchTerm, setSearchTerm]                 = useState('');
    const [sortBy, setSortBy]                         = useState('last_name');
    const [staffCount, setStaffCount]                 = useState(0);
    const [isRolesModalOpen, setIsRolesModalOpen]     = useState(false);
    const [editStaffModalOpen, setEditStaffModalOpen] = useState(false);
    const [staffToEdit, setStaffToEdit]               = useState(null);
    const [filters, setFilters] = useState({ roles: [], shifts: [], employmentDates: [] });
    const [toast, setToast]     = useState({ open: false, type: 'success', title: '', message: '' });

    const showToast = (type, title, message = '') =>
        setToast({ open: true, type, title, message });

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [data, count] = await Promise.all([
                staffService.getAllMedicalStaff(),
                staffService.getStaffCount(),
            ]);
            setStaffList(data);
            setStaffCount(count);
        } catch (err) {
            console.error(err);
            showToast('error', t('staff.fetch_list_error'));
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (staff) => {
        setStaffToEdit(staff);
        setEditStaffModalOpen(true);
    };

    const handleAddStaff = async (formData) => {
        try {
            await staffService.addStaff(formData);
            setIsModalOpen(false);
            await loadAll();
            showToast('success', t('staff.added'));
        } catch (err) {
            showToast('error', t('staff.add_error'), err.response?.data?.message || '');
            throw err;
        }
    };

    const handleDeleteStaff = async (userId) => {
        if (!window.confirm(t('staff.delete_confirm'))) return;
        try {
            await staffService.deleteStaff(userId);
            await loadAll();
            showToast('success', t('staff.deleted'));
        } catch {
            showToast('error', t('staff.delete_error'));
        }
    };

    // ── Блокування / розблокування ────────────────────────────────────────────
    const handleBlockStaff = async (userId, isBlocked) => {
        const confirmMsg = isBlocked
            ? (t('staff.actions.unblock_confirm') || 'Розблокувати цей акаунт?')
            : (t('staff.actions.block_confirm')   || 'Заблокувати цей акаунт?');

        if (!window.confirm(confirmMsg)) return;

        try {
            if (isBlocked) {
                await staffService.unblockStaff(userId);
                showToast('success', t('staff.actions.unblocked') || 'Акаунт розблоковано');
            } else {
                await staffService.blockStaff(userId);
                showToast('success', t('staff.actions.blocked_success') || 'Акаунт заблоковано');
            }
            await loadAll();
        } catch {
            showToast('error', t('staff.update_error'));
        }
    };

    const updateFilters = (type, value) => {
        setFilters(prev => ({
            ...prev,
            [type]: prev[type].includes(value)
                ? prev[type].filter(i => i !== value)
                : [...prev[type], value]
        }));
    };

    const isEmploymentDateInRange = (admissionDateStr, selectedRanges) => {
        if (!admissionDateStr) return false;
        const admissionDate = new Date(admissionDateStr);
        if (isNaN(admissionDate.getTime())) return false;
        const now = new Date();
        const checks = {
            month:  admissionDate >= new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
            year:   admissionDate >= new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
            decade: admissionDate >= new Date(now.getFullYear() - 10, now.getMonth(), now.getDate()),
        };
        return selectedRanges.some(r => checks[r]);
    };

    const filteredStaff = staffList
        .filter(user => {
            const roleMatches  = filters.roles.length === 0 || filters.roles.includes(user.roles?.role_name?.toLowerCase());
            const shiftMatches = filters.shifts.length === 0 || filters.shifts.includes(user.medical_staff?.shift);
            const dateMatches  = filters.employmentDates.length === 0 || isEmploymentDateInRange(user.medical_staff?.admission_date, filters.employmentDates);
            const nameMatches  = searchTerm.trim() === '' ||
                [user.last_name, user.first_name, user.patronymic].join(' ').toLowerCase().includes(searchTerm.toLowerCase());
            return roleMatches && shiftMatches && dateMatches && nameMatches;
        })
        .sort((a, b) => {
            if (sortBy === 'last_name')  return a.last_name.localeCompare(b.last_name);
            if (sortBy === 'first_name') return a.first_name.localeCompare(b.first_name);
            if (sortBy === 'role')       return (a.roles?.role_name || '').localeCompare(b.roles?.role_name || '');
            return 0;
        });

    const computeCounts = (list) => {
        const now = new Date();
        const counts = {
            roles: { doctor: 0, staff: 0 },
            shifts: { 'Денна': 0, 'Нічна': 0 },
            employmentDates: { month: 0, year: 0, decade: 0 },
        };
        list.forEach(user => {
            const role = user.roles?.role_name?.toLowerCase();
            if (counts.roles[role] !== undefined) counts.roles[role]++;
            const shift = user.medical_staff?.shift;
            if (counts.shifts[shift] !== undefined) counts.shifts[shift]++;
            const d = new Date(user.medical_staff?.admission_date);
            if (!isNaN(d)) {
                if (d >= new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()))  counts.employmentDates.month++;
                if (d >= new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()))  counts.employmentDates.year++;
                if (d >= new Date(now.getFullYear() - 10, now.getMonth(), now.getDate())) counts.employmentDates.decade++;
            }
        });
        return counts;
    };

    const counts = computeCounts(staffList);

    if (loading) return <LoaderOverlay />;

    return (
        <div className={styles.container}>
            <StaffHeader
                onAddClick={() => setIsModalOpen(true)}
                staffCount={staffCount}
                onOpenRoles={() => setIsRolesModalOpen(true)}
                onExport={staffService.exportStaffToExcel}
            />

            <div className={styles.content}>
                <StaffFilters
                    filters={filters}
                    updateFilters={updateFilters}
                    setFilters={setFilters}
                    counts={counts}
                />
                <div className={styles.rightBlock}>
                    <StaffSearchBar
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                    />
                    <StaffTable
                        staffList={filteredStaff}
                        onEditStaff={openEditModal}
                        onDeleteStaff={handleDeleteStaff}
                        onBlockStaff={handleBlockStaff}
                    />
                </div>
            </div>

            {isModalOpen && (
                <AddStaffModal onClose={() => setIsModalOpen(false)} onSave={handleAddStaff} />
            )}
            {isRolesModalOpen && (
                <RolesModal onClose={() => setIsRolesModalOpen(false)} />
            )}
            {editStaffModalOpen && (
                <EditStaffModal
                    onClose={() => setEditStaffModalOpen(false)}
                    onSave={async (updatedData) => {
                        try {
                            await staffService.updateStaff(updatedData);
                            setEditStaffModalOpen(false);
                            await loadAll();
                            showToast('success', t('staff.update_success'));
                        } catch (err) {
                            showToast('error', t('staff.update_error'), err.response?.data?.message || '');
                        }
                    }}
                    staffData={staffToEdit}
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

export default StaffPage;