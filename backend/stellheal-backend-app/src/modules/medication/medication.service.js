export class MedicationService {
    // додавання препарату
    async addMedication(db, medication_name, medication_type, description, quantity, manufacturer, expiration_date) {
        try {
            const quantityInt = parseInt(quantity, 10);
            
            if (isNaN(quantityInt)) {
                throw new Error('Quantity must be a valid integer');
            }
            
            const newMedication = await db.medication.create({
                data: {
                    medication_name,
                    medication_type,
                    description,
                    quantity: quantityInt, 
                    manufacturer,
                    expiration_date: expiration_date ? new Date(expiration_date) : null,
                }
            });

            return newMedication; 
        } catch (error) {
            console.error('Error adding medication:', error);
            throw new Error('Failed to add medication');
        }
    }

    // видалення препарату
    async deleteMedication(db, id) {
        try {
            const medication = await db.medication.findUnique({
                where: { id_medication: parseInt(id) },
            });

            if (!medication) {
                return null;
            }

            const deletedMedication = await db.medication.delete({
                where: { id_medication: parseInt(id) },
            });

            return deletedMedication;
        } catch (error) {
            throw new Error(`Error deleting medication: ${error.message}`);
        }
    }

    // оновлення препарату
    async updateMedicationQuantity(db, id, quantity) {
        try {
            const quantityInt = parseInt(quantity, 10);
    
            if (isNaN(quantityInt) || quantityInt < 0) {
                throw new Error('Quantity must be a valid non-negative integer');
            }
    
            const medication = await db.medication.findUnique({
                where: { id_medication: parseInt(id) },
            });
    
            if (!medication) {
                return null;
            }
    
            const updatedMedication = await db.medication.update({
                where: { id_medication: parseInt(id) },
                data: { quantity: quantityInt },
            });
    
            return updatedMedication;
        } catch (error) {
            console.error('Error updating medication quantity:', error);
            throw new Error('Failed to update medication quantity');
        }
    }
}
