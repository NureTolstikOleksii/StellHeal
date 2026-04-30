import prisma from '../../config/prisma.js';

export class WardsService {

    // ok
    async getAvailableWards() {

        const wards = await prisma.wards.findMany({
            select: {
                ward_id: true,
                ward_number: true,
                capacity: true,
                prescriptions: {
                    where: {
                        end_date: { gte: new Date() }
                    },
                    select: {
                        prescription_id: true
                    }
                }
            }
        });

        const freeWards = wards.filter(
            w => w.prescriptions.length < (w.capacity || 0)
        );

        return freeWards.map(w => ({
            id: w.ward_id,
            number: w.ward_number
        }));
    }
}