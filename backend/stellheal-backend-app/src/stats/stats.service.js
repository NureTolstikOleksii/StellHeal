import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class StatsService {
    // отримання статистики закладу
    async getClinicStats() {
        const now = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);

        const [activePatients, medicalStaff, treatmentPlans, deviceTriggers, missedAppointments] = await Promise.all([
            prisma.users.count({ where: { role_id: 3 } }), // 3 = пацієнти
            prisma.medical_staff.count(),
            prisma.prescriptions.count({ where: { end_date: { lt: new Date() } } }),
            prisma.prescription_medications.count({
                where: {
                    intake_status: true,
                    intake_date: {
                        gte: weekAgo
                    }
                }
            }),
            prisma.prescription_medications.count({
                where: {
                    intake_status: false,
                    intake_date: {
                        gte: weekAgo
                    }
                }
            }),
        ]);
        return {
            activePatients,
            medicalStaff,
            treatmentPlans,
            deviceTriggers,
            missedAppointments,
        };
    }

    // отримання статистики лікарів
    async getDoctorStats() {
        const doctors = await prisma.users.findMany({
            where: { role_id: 1 }, // 1 = лікарі
            include: {
                prescriptions_prescriptions_doctor_idTousers: {
                    include: {
                        users_prescriptions_patient_idTousers: true,
                        prescription_medications: {
                            where: { intake_date: { gte: new Date() } } // активні
                        }
                    }
                }
            }
        });

        return doctors.map(doc => {
            const name = `${doc.last_name}`;
            const patientsCount = doc.prescriptions_prescriptions_doctor_idTousers.length;
            const activePrescriptionsCount = doc.prescriptions_prescriptions_doctor_idTousers.reduce(
                (sum, p) => sum + (p.prescription_medications?.length || 0),
                0
            );
            return {
                name,
                patients: patientsCount,
                active: activePrescriptionsCount
            };
        });
    }
}
