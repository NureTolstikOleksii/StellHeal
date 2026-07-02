import { describe, it, expect, vi } from 'vitest';

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

const { authorizeRoles } = await import('../../src/middleware/role.middleware.js');
const makeNext = () => vi.fn();

describe('authorizeRoles', () => {

    it('should return 401 if req.user is missing', () => {
        const middleware = authorizeRoles(1, 2);
        const next = makeNext();
        middleware({}, {}, next);
        expect(next.mock.calls[0][0].status).toBe(401);
    });

    it('should return 403 if roleId is not in the allowed list', () => {
        const middleware = authorizeRoles(1, 2);
        const next = makeNext();
        middleware({ user: { roleId: 3 } }, {}, next);
        expect(next.mock.calls[0][0].status).toBe(403);
        expect(next.mock.calls[0][0].message).toBe('Access denied');
    });

    it('should call next() if roleId is allowed', () => {
        const middleware = authorizeRoles(1, 2);
        const next = makeNext();
        middleware({ user: { roleId: 1 } }, {}, next);
        expect(next).toHaveBeenCalledWith();
    });

    it('should support multiple allowed roles', () => {
        const middleware = authorizeRoles(1, 2, 4);
        const n1 = makeNext(); const n2 = makeNext(); const n3 = makeNext();
        middleware({ user: { roleId: 2 } }, {}, n1);
        middleware({ user: { roleId: 4 } }, {}, n2);
        middleware({ user: { roleId: 5 } }, {}, n3);
        expect(n1).toHaveBeenCalledWith();
        expect(n2).toHaveBeenCalledWith();
        expect(n3.mock.calls[0][0].status).toBe(403);
    });
});