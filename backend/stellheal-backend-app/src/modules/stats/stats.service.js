import prisma from '../../config/prisma.js';

export class StatsService {

    // статистика клініки
    async getClinicStats() {
        const now = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);

        const [
            activePatients,
            medicalStaff,
            treatmentPlans,
            deviceTriggers,
            missedAppointments
        ] = await Promise.all([

            prisma.users.count({
                where: { role_id: 3 } // patient
            }),

            prisma.users.count({
                where: { role_id: 2 } // staff
            }),

            prisma.prescriptions.count({
                where: {
                    end_date: { lt: new Date() }
                }
            }),

            prisma.prescription_medications.count({
                where: {
                    intake_status: true,
                    intake_date: { gte: weekAgo }
                }
            }),

            prisma.prescription_medications.count({
                where: {
                    intake_status: false,
                    intake_date: { gte: weekAgo }
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

    // статистика лікарів
    async getDoctorStats() {

        const doctors = await prisma.users.findMany({
            where: { role_id: 1 }, // doctor
            include: {
                prescriptions_prescriptions_doctor_idTousers: {
                    include: {
                        prescription_medications: {
                            where: {
                                intake_date: { gte: new Date() }
                            }
                        }
                    }
                }
            }
        });

        return doctors.map(doc => {

            const patientsCount = doc.prescriptions_prescriptions_doctor_idTousers.length;

            const activePrescriptionsCount =
                doc.prescriptions_prescriptions_doctor_idTousers.reduce(
                    (sum, p) => sum + (p.prescription_medications?.length || 0),
                    0
                );

            return {
                name: doc.last_name,
                patients: patientsCount,
                active: activePrescriptionsCount
            };
        });
    }
}