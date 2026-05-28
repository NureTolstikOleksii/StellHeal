import prisma from '../../config/prisma.js';

export class StatsService {

    // clinic statistics ok
    async getClinicStats() {
        const now     = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);

        const [
            activePatients,
            medicalStaff,
            treatmentPlans,
            deviceTriggers,
            missedAppointments
        ] = await Promise.all([
            prisma.users.count({ where: { role_id: 3 } }),
            prisma.users.count({ where: { role_id: 2 } }),
            prisma.prescriptions.count({ where: { end_date: { lt: new Date() } } }),
            prisma.prescription_medications.count({
                where: { intake_status: true, intake_date: { gte: weekAgo } }
            }),
            prisma.prescription_medications.count({
                where: { intake_status: false, intake_date: { gte: weekAgo } }
            }),
        ]);

        return { activePatients, medicalStaff, treatmentPlans, deviceTriggers, missedAppointments };
    }

    // doctor statistics ok
    async getDoctorStats() {
        const doctors = await prisma.users.findMany({
            where: { role_id: 1 },
            include: {
                medical_staff: { select: { specialization: true } },
                prescriptions_prescriptions_doctor_idTousers: {
                    include: {
                        prescription_medications: {
                            select: { intake_status: true, intake_date: true }
                        }
                    }
                }
            }
        });

        return doctors.map(doc => {
            const prescriptions = doc.prescriptions_prescriptions_doctor_idTousers;
            const allMeds       = prescriptions.flatMap(p => p.prescription_medications);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const activeMeds = allMeds.filter(
                m => !m.intake_date || new Date(m.intake_date) >= today
            );

            const withStatus = allMeds.filter(m => m.intake_status !== null);
            const taken      = withStatus.filter(m => m.intake_status === true).length;
            const intakeRate = withStatus.length > 0
                ? Math.round((taken / withStatus.length) * 100)
                : null;

            return {
                name:           `${doc.last_name} ${doc.first_name}`,
                avatar:         doc.avatar || null,
                specialization: doc.medical_staff?.specialization || null,
                patients:       prescriptions.length,
                active:         activeMeds.length,
                intakeRate,
            };
        });
    }

    // intake week stats ok
    async getIntakeWeekStats() {
        const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            d.setHours(0, 0, 0, 0);
            return d;
        });

        const startDate = days[0];
        const endDate   = new Date();
        endDate.setHours(23, 59, 59, 999);

        const meds = await prisma.prescription_medications.findMany({
            where: {
                intake_date:   { gte: startDate, lte: endDate },
                intake_status: { not: null },
            },
            select: { intake_date: true, intake_status: true }
        });

        return days.map(day => {
            const dayStr  = day.toISOString().substring(0, 10);
            const dayMeds = meds.filter(m =>
                m.intake_date &&
                new Date(m.intake_date).toISOString().substring(0, 10) === dayStr
            );
            return {
                day:    DAY_NAMES[day.getDay()],
                date:   dayStr,
                taken:  dayMeds.filter(m => m.intake_status === true).length,
                missed: dayMeds.filter(m => m.intake_status === false).length,
            };
        });
    }

    // ── Audit log — останні N дій в системі ──────────────────────────────────
    async getAuditLog({ limit = 50, action = null, page = 1 } = {}) {
        const skip = (page - 1) * limit;

        const where = action ? { action } : {};

        const [logs, total] = await Promise.all([
            prisma.audit_logs.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
                include: {
                    users: {
                        select: {
                            first_name: true,
                            last_name:  true,
                            avatar:     true,
                            roles:      { select: { role_name: true } },
                        }
                    }
                }
            }),
            prisma.audit_logs.count({ where }),
        ]);

        return {
            logs: logs.map(log => ({
                id:          log.id,
                action:      log.action,
                entity:      log.entity,
                entity_id:   log.entity_id,
                description: log.description,
                ip_address:  log.ip_address,
                created_at:  log.created_at,
                user: log.users
                    ? {
                        name:   `${log.users.last_name} ${log.users.first_name}`,
                        avatar: log.users.avatar || null,
                        role:   log.users.roles?.role_name || null,
                    }
                    : null,
            })),
            total,
            page,
            pages: Math.ceil(total / limit),
        };
    }

    // ── Унікальні типи дій для фільтру ───────────────────────────────────────
    async getAuditActions() {
        const actions = await prisma.audit_logs.findMany({
            select:   { action: true },
            distinct: ['action'],
            orderBy:  { action: 'asc' },
        });
        return actions.map(a => a.action);
    }
}