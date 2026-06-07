import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test_secret';

vi.mock('../../src/shared/errors/AppError.js', () => ({
    AppError: class AppError extends Error {
        constructor(code, message, status) {
            super(message);
            this.code = code; this.status = status;
        }
    }
}));
vi.mock('../../src/shared/constants/errorCodes.js', () => ({
    ERROR_CODES: { UNAUTHORIZED: 'UNAUTHORIZED', FORBIDDEN: 'FORBIDDEN' }
}));

const { authenticateDevice } = await import('../../src/middleware/device.middleware.js');
const makeReq  = (auth) => ({ headers: { authorization: auth } });
const makeNext = () => vi.fn();

describe('authenticateDevice', () => {

    it('should return 401 if Authorization header is missing', () => {
        const next = makeNext();
        authenticateDevice(makeReq(undefined), {}, next);
        expect(next.mock.calls[0][0].status).toBe(401);
    });

    it('should return 401 if token is invalid', () => {
        const next = makeNext();
        authenticateDevice(makeReq('Bearer bad_token'), {}, next);
        expect(next.mock.calls[0][0].status).toBe(401);
    });

    it('should return 401 if it is a user token (type != device)', () => {
        const token = jwt.sign({ userId: 1, roleId: 2 }, 'test_secret');
        const next  = makeNext();
        authenticateDevice(makeReq(`Bearer ${token}`), {}, next);
        expect(next.mock.calls[0][0].status).toBe(401);
    });

    it('should set req.device and call next() for a valid device token', () => {
        const token = jwt.sign({ containerId: 5, type: 'device' }, 'test_secret');
        const req   = makeReq(`Bearer ${token}`);
        const next  = makeNext();
        authenticateDevice(req, {}, next);
        expect(next).toHaveBeenCalledWith();
        expect(req.device.containerId).toBe(5);
        expect(req.device.type).toBe('device');
    });
});