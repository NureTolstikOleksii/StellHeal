import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { RegisterService } from './registration.service.js';

const router = Router();
const regService = new RegisterService();

const registerUser = async (req, res, role) => {
    const { email, password, last_name, first_name, birth_date, address } = req.body;

    const missingFields = {};
    if (!email) missingFields.email = 'Email is required';
    if (!password) missingFields.password = 'Password is required';
    if (!last_name) missingFields.last_name = 'Last name is required';
    if (!first_name) missingFields.first_name = 'First name is required';
    if (!birth_date) missingFields.birth_date = 'Birth date is required';
    if (!address) missingFields.address = 'Address is required';

    if (Object.keys(missingFields).length > 0) {
        return res.status(400).json({ message: 'Please enter all data.', missingFields });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: 'Invalid email format.' });
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d._-]{8,128}$/.test(password)) {
        return res.status(400).json({
            message: 'Password must have 8-128 characters, include at least one uppercase, lowercase letter, one numeral, and may contain . _ -'
        });
    }

    try {;
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await regService.createUserAccount(
            req.db,
            { email, password: hashedPassword, last_name, first_name, birth_date, address },
            role
        );
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ message: `Failed to create ${role} account`, error: error.message });
    }
};

router.post('/doctor', (req, res) => {
    registerUser(req, res, 1);
});

router.post('/nurse', (req, res) => {
    registerUser(req, res, 2);
});

router.post('/patient', (req, res) => {
    registerUser(req, res, 3);
});

router.post('/admin', (req, res) => {
    registerUser(req, res, 4);
});

export const registerRouter = router;
