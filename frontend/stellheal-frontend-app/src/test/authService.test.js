import { describe, it, expect, vi, beforeEach } from 'vitest';


vi.mock('axios');
vi.mock('../utils/api.js', () => ({
    default: {
        post: vi.fn(),
    }
}));

import api from '../utils/api.js';
import {
    loginUser,
    refreshTokenRequest,
    sendResetEmail,
    resetPassword,
} from '../services/authService.js';

beforeEach(() => vi.clearAllMocks());


describe('loginUser', () => {

    it('calls POST /auth/login with correct payload', async () => {
        api.post.mockResolvedValue({
            data: {
                accessToken:  'access123',
                refreshToken: 'refresh456',
                user: { id: 1, role: 'admin' }
            }
        });

        await loginUser('doctor@test.com', 'Qwerty123!');

        expect(api.post).toHaveBeenCalledWith(
            '/auth/login',
            expect.objectContaining({
                email:    'doctor@test.com',
                password: 'Qwerty123!',
                platform: 'web',
            }),
            expect.any(Object)
        );
    });

    it('returns response data on success', async () => {
        const mockData = {
            accessToken:  'access123',
            refreshToken: 'refresh456',
            user: { id: 1, role: 'admin' }
        };
        api.post.mockResolvedValue({ data: mockData });

        const result = await loginUser('doctor@test.com', 'Qwerty123!');
        expect(result).toEqual(mockData);
    });

    it('includes platform: "web" in request', async () => {
        api.post.mockResolvedValue({ data: {} });
        await loginUser('a@b.com', 'pass');

        const callArgs = api.post.mock.calls[0][1];
        expect(callArgs.platform).toBe('web');
    });

    it('includes x-timezone header', async () => {
        api.post.mockResolvedValue({ data: {} });
        await loginUser('a@b.com', 'pass');

        const headers = api.post.mock.calls[0][2]?.headers;
        expect(headers).toHaveProperty('x-timezone');
    });

    it('throws error when request fails', async () => {
        api.post.mockRejectedValue(new Error('Network error'));
        await expect(loginUser('a@b.com', 'pass')).rejects.toThrow('Network error');
    });
});

describe('refreshTokenRequest', () => {

    it('calls POST /auth/refresh with refreshToken', async () => {
        api.post.mockResolvedValue({
            data: { accessToken: 'new_access', refreshToken: 'new_refresh' }
        });

        await refreshTokenRequest('old_refresh_token');

        expect(api.post).toHaveBeenCalledWith(
            '/auth/refresh',
            { refreshToken: 'old_refresh_token' }
        );
    });

    it('returns response with new tokens', async () => {
        const mockData = { accessToken: 'new_access', refreshToken: 'new_refresh' };
        api.post.mockResolvedValue({ data: mockData });

        const result = await refreshTokenRequest('old_token');
        expect(result.data).toEqual(mockData);
    });

    it('throws error when refresh fails', async () => {
        api.post.mockRejectedValue(new Error('Unauthorized'));
        await expect(refreshTokenRequest('bad_token')).rejects.toThrow('Unauthorized');
    });
});

describe('sendResetEmail', () => {

    it('calls POST /auth/forgot-password with email', async () => {
        api.post.mockResolvedValue({ data: { message: 'Email sent' } });

        await sendResetEmail('doctor@test.com');

        expect(api.post).toHaveBeenCalledWith(
            '/auth/forgot-password',
            { email: 'doctor@test.com' }
        );
    });

    it('throws error when request fails', async () => {
        api.post.mockRejectedValue(new Error('Not found'));
        await expect(sendResetEmail('unknown@test.com')).rejects.toThrow('Not found');
    });
});

describe('resetPassword', () => {

    it('calls POST /auth/reset-password with token and newPassword', async () => {
        api.post.mockResolvedValue({ data: { message: 'Password reset' } });

        await resetPassword('reset-token-123', 'NewPass123!');

        expect(api.post).toHaveBeenCalledWith(
            '/auth/reset-password',
            { token: 'reset-token-123', newPassword: 'NewPass123!' }
        );
    });

    it('throws error when token is invalid', async () => {
        api.post.mockRejectedValue(new Error('Invalid token'));
        await expect(resetPassword('bad-token', 'pass')).rejects.toThrow('Invalid token');
    });
});