import { Router } from 'express';
import { MedicationService } from './medication.service.js';

const router = Router();
const medicationService = new MedicationService();

// отримання випадаючого списку препаратів
router.get('/', async (req, res) => {
    try {
        const medications = await req.db.medications.findMany({
            select: {
                medication_id: true,
                name: true
            }
        });

        res.json(medications.map(m => ({
            id: m.medication_id,
            name: m.name
        })));
    } catch (err) {
        console.error('Помилка при отриманні препаратів:', err);
        res.status(500).json({ message: 'Не вдалося завантажити препарати' });
    }
});

// додавання нового препарату
router.post('/add', async (req, res) => {
    const { medication_name, medication_type, description, quantity, manufacturer, expiration_date } = req.body;

    if (!medication_name || !medication_type || !description ) {
        return res.status(400).json({ message: 'All fields are required!.' });
    }

    try {
        const newMedication = await medicationService.addMedication(
            req.db, 
            medication_name, 
            medication_type, 
            description, 
            quantity, 
            manufacturer, 
            expiration_date
        );
        
        res.status(201).json({ message: 'The medication has been added successfully', medication: newMedication });
    } catch (error) {
        console.error('Error when adding the medication:', error);
        res.status(500).json({ message: 'An error occurred on the server' });
    }
});

// видалення препарату
router.delete('/delete/:id', async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ message: 'Medication ID is required.' });
    }

    try {
        const deletedMedication = await medicationService.deleteMedication(req.db, id);
        
        if (!deletedMedication) {
            return res.status(404).json({ message: 'Medication not found.' });
        }

        res.status(200).json({ message: 'Medication has been successfully deleted.', medication: deletedMedication });
    } catch (error) {
        console.error('Error when deleting the medication:', error);
        res.status(500).json({ message: 'An error occurred on the server' });
    }
});

// оновлення кількості препарату
router.put('/update-quantity/:id', async (req, res) => {
    const { id } = req.params;
    const { quantity } = req.body;

    if (!id || quantity === undefined) {
        return res.status(400).json({ message: 'Medication ID and quantity are required.' });
    }

    try {
        const updatedMedication = await medicationService.updateMedicationQuantity(req.db, id, quantity);

        if (!updatedMedication) {
            return res.status(404).json({ message: 'Medication not found.' });
        }

        res.status(200).json({
            message: 'Medication quantity has been successfully updated.',
            medication: updatedMedication,
        });
    } catch (error) {
        console.error('Error updating medication quantity:', error);
        res.status(500).json({ message: 'An error occurred on the server' });
    }
});

export const medicationRouter = router;
