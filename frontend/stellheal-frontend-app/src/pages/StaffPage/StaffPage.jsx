import React, { useEffect, useState } from 'react';
import styles from './StaffPage.module.css';
import StaffHeader from './StaffHeader';
import StaffFilters from './StaffFilters';
import StaffSearchBar from './StaffSearchBar';
import StaffTable from './StaffTable';
import AddStaffModal from './AddStaffModal';
import RolesModal from './RolesModal';
import EditStaffModal from './EditStaffModal';
import * as staffService from '../../services/staffService';
import { useTranslation } from 'react-i18next';

const StaffPage = () => {
    const { t } = useTranslation();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [staffList, setStaffList] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('last_name');
    const [staffCount, setStaffCount] = useState(0);
    const [isRolesModalOpen, setIsRolesModalOpen] = useState(false);
    const [editStaffModalOpen, setEditStaffModalOpen] = useState(false);
    const [staffToEdit, setStaffToEdit] = useState(null);
    const [filters, setFilters] = useState({
        roles: [],
        shifts: [],
        employmentDates: [],
    });

    useEffect(() => {
        fetchStaff();
        fetchCount();
    }, []);

    const openEditModal = (staff) => {
        setStaffToEdit(staff);
        setEditStaffModalOpen(true);
    };

    const fetchCount = async () => {
        try {
            const count = await staffService.getStaffCount();
            setStaffCount(count);
        } catch (err) {
            console.error(t('staff.fetch_count_error'), err);
        }
    };

    const fetchStaff = async () => {
        try {
            const data = await staffService.getAllMedicalStaff();
            setStaffList(data);
        } catch (err) {
            console.error(t('staff.fetch_list_error'), err);
        }
    };

    const handleAddStaff = async (formData) => {
        const newStaff = await staffService.addStaff(formData);
        setIsModalOpen(false);
        await fetchStaff();
        return newStaff;
    };

    const updateFilters = (type, value) => {
        setFilters((prev) => {
            const list = prev[type];
            const updated = list.includes(value)
                ? list.filter((item) => item !== value)
                : [...list, value];
            return { ...prev, [type]: updated };
        });
    };

    const isEmploymentDateInRange = (admissionDateStr, selectedRanges) => {
        if (!admissionDateStr) return false;
        const admissionDate = new Date(admissionDateStr);
        if (isNaN(admissionDate.getTime())) return false;

        const now = new Date();
        const checks = {
            month: (() => {
                const lastMonth = new Date(now);
                lastMonth.setMonth(now.getMonth() - 1);
                return admissionDate >= lastMonth;
            })(),
            year: (() => {
                const lastYear = new Date(now);
                lastYear.setFullYear(now.getFullYear() - 1);
                return admissionDate >= lastYear;
            })(),
            decade: (() => {
                const lastDecade = new Date(now);
                lastDecade.setFullYear(now.getFullYear() - 10);
                return admissionDate >= lastDecade;
            })(),
        };
        return selectedRanges.some((range) => checks[range]);
    };

    const filteredStaff = staffList
        .filter((user) => {
            const roleMatches =
                filters.roles.length === 0 ||
                filters.roles.includes(user.roles?.role_name?.toLowerCase());

            const shiftMatches =
                filters.shifts.length === 0 ||
                filters.shifts.includes(user.medical_staff?.shift);

            const dateMatches =
                filters.employmentDates.length === 0 ||
                isEmploymentDateInRange(user.medical_staff?.admission_date, filters.employmentDates);

            const nameMatches =
                searchTerm.trim() === '' ||
                [user.last_name, user.first_name, user.patronymic]
                    .join(' ')
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase());

            return roleMatches && shiftMatches && dateMatches && nameMatches;
        })
        .sort((a, b) => {
            if (sortBy === 'last_name') {
                return a.last_name.localeCompare(b.last_name);
            }
            if (sortBy === 'first_name') {
                return a.first_name.localeCompare(b.first_name);
            }
            if (sortBy === 'role') {
                return (a.roles?.role_name || '').localeCompare(b.roles?.role_name || '');
            }
            return 0;
        });

    const computeCounts = (list) => {
        const counts = {
            roles: { doctor: 0, staff: 0 },
            shifts: { 'Денна': 0, 'Нічна': 0 },
            employmentDates: { month: 0, year: 0, decade: 0 },
        };

        const now = new Date();
        list.forEach((user) => {
            const role = user.roles?.role_name?.toLowerCase();
            if (counts.roles[role] !== undefined) {
                counts.roles[role]++;
            }

            const shift = user.medical_staff?.shift;
            if (counts.shifts[shift] !== undefined) {
                counts.shifts[shift]++;
            }

            const admissionDate = new Date(user.medical_staff?.admission_date);
            if (!isNaN(admissionDate)) {
                const oneMonthAgo = new Date(now);
                oneMonthAgo.setMonth(now.getMonth() - 1);

                const oneYearAgo = new Date(now);
                oneYearAgo.setFullYear(now.getFullYear() - 1);

                const tenYearsAgo = new Date(now);
                tenYearsAgo.setFullYear(now.getFullYear() - 10);

                if (admissionDate >= oneMonthAgo) counts.employmentDates.month++;
                if (admissionDate >= oneYearAgo) counts.employmentDates.year++;
                if (admissionDate >= tenYearsAgo) counts.employmentDates.decade++;
            }
        });

        return counts;
    };

    const handleDeleteStaff = async (userId) => {
        if (window.confirm(t('staff.delete_confirm'))) {
            try {
                await staffService.deleteStaff(userId);
                fetchStaff();
            } catch (err) {
                alert(t('staff.delete_error'));
                console.error(err);
            }
        }
    };

    const counts = computeCounts(staffList);

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
                    />
                </div>
            </div>
            {isModalOpen && (
                <AddStaffModal
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleAddStaff}
                />
            )}
            {isRolesModalOpen && (
                <RolesModal onClose={() => setIsRolesModalOpen(false)} />
            )}
            {editStaffModalOpen && (
                <EditStaffModal
                    onClose={() => setEditStaffModalOpen(false)}
                    onSave={async (updatedData) => {
                        await staffService.updateStaff(updatedData);
                        setEditStaffModalOpen(false);
                        fetchStaff();
                    }}
                    staffData={staffToEdit}
                />
            )}
        </div>
    );
};

export default StaffPage;
