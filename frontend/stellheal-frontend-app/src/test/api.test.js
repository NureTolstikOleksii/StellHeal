import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';


vi.mock('../services/authService.js', () => ({
    refreshTokenRequest: vi.fn(),
}));

import { refreshTokenRequest } from '../services/authService.js';
import api from '../utils/api.js';

let mockAxios;

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAxios = new MockAdapter(api);
});

afterEach(() => {
    mockAxios.restore();
    localStorage.clear();
});

describe('Request interceptor', () => {

    it('adds Authorization header when accessToken exists in localStorage', async () => {
        localStorage.setItem('accessToken', 'my-access-token');
        mockAxios.onGet('/test').reply(200, { ok: true });

        await api.get('/test');

        const request = mockAxios.history.get[0];
        expect(request.headers.Authorization).toBe('Bearer my-access-token');
    });

    it('does NOT add Authorization header when no token in localStorage', async () => {
        mockAxios.onGet('/test').reply(200, { ok: true });

        await api.get('/test');

        const request = mockAxios.history.get[0];
        expect(request.headers.Authorization).toBeUndefined();
    });

    it('uses token from localStorage at request time', async () => {
        localStorage.setItem('accessToken', 'token-v1');
        mockAxios.onGet('/test').reply(200, {});

        await api.get('/test');

        expect(mockAxios.history.get[0].headers.Authorization).toBe('Bearer token-v1');
    });
});

describe('Response interceptor — success', () => {

    it('passes through successful responses unchanged', async () => {
        mockAxios.onGet('/patients').reply(200, [{ id: 1, name: 'John' }]);

        const res = await api.get('/patients');
        expect(res.status).toBe(200);
        expect(res.data).toEqual([{ id: 1, name: 'John' }]);
    });

    it('passes through 201 responses', async () => {
        mockAxios.onPost('/patients/create').reply(201, { message: 'Created' });

        const res = await api.post('/patients/create', {});
        expect(res.status).toBe(201);
    });
});

describe('Response interceptor — token refresh on 401', () => {

    it('attempts refresh when 401 received with refreshToken', async () => {
        localStorage.setItem('refreshToken', 'old-refresh');
        mockAxios.onGet('/patients').replyOnce(401).onGet('/patients').reply(200, []);
        refreshTokenRequest.mockResolvedValue({
            data: { accessToken: 'new-access', refreshToken: 'new-refresh' }
        });

        await api.get('/patients');
        expect(refreshTokenRequest).toHaveBeenCalledWith('old-refresh');
    });

    it('saves new tokens to localStorage after successful refresh', async () => {
        localStorage.setItem('refreshToken', 'old-refresh');
        mockAxios.onGet('/patients').replyOnce(401).onGet('/patients').reply(200, []);
        refreshTokenRequest.mockResolvedValue({
            data: { accessToken: 'new-access', refreshToken: 'new-refresh' }
        });

        await api.get('/patients');
        expect(localStorage.getItem('accessToken')).toBe('new-access');
        expect(localStorage.getItem('refreshToken')).toBe('new-refresh');
    });

    it('retries original request with new token after refresh', async () => {
        localStorage.setItem('refreshToken', 'old-refresh');
        mockAxios.onGet('/patients').replyOnce(401).onGet('/patients').reply(200, [{ id: 1 }]);
        refreshTokenRequest.mockResolvedValue({
            data: { accessToken: 'new-access', refreshToken: 'new-refresh' }
        });

        const res = await api.get('/patients');
        expect(res.data).toEqual([{ id: 1 }]);
        expect(mockAxios.history.get).toHaveLength(2);
    });

    it('does NOT attempt refresh on 401 for auth endpoints', async () => {
        localStorage.setItem('refreshToken', 'old-refresh');
        mockAxios.onPost('/auth/login').reply(401, { message: 'Invalid credentials' });

        await expect(api.post('/auth/login', {})).rejects.toThrow();
        expect(refreshTokenRequest).not.toHaveBeenCalled();
    });

    it('does NOT attempt refresh when no refreshToken in localStorage', async () => {
        mockAxios.onGet('/patients').reply(401);

        await expect(api.get('/patients')).rejects.toThrow();
        expect(refreshTokenRequest).not.toHaveBeenCalled();
    });

    it('also attempts refresh on 403', async () => {
        localStorage.setItem('refreshToken', 'old-refresh');
        mockAxios.onGet('/patients').replyOnce(403).onGet('/patients').reply(200, []);
        refreshTokenRequest.mockResolvedValue({
            data: { accessToken: 'new-access', refreshToken: 'new-refresh' }
        });

        await api.get('/patients');
        expect(refreshTokenRequest).toHaveBeenCalledOnce();
    });
});

describe('Response interceptor — refresh failure', () => {

    it('clears localStorage when refresh fails', async () => {
        localStorage.setItem('accessToken',  'old-access');
        localStorage.setItem('refreshToken', 'old-refresh');
        localStorage.setItem('user', JSON.stringify({ id: 1 }));

        mockAxios.onGet('/patients').reply(401);
        refreshTokenRequest.mockRejectedValue(new Error('Refresh failed'));

        Object.defineProperty(window, 'location', {
            value: { href: '/' }, writable: true,
        });

        try { await api.get('/patients'); } catch {}

        expect(localStorage.getItem('accessToken')).toBeNull();
        expect(localStorage.getItem('refreshToken')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
    });

    it('redirects to "/" when refresh fails', async () => {
        localStorage.setItem('refreshToken', 'old-refresh');
        mockAxios.onGet('/patients').reply(401);
        refreshTokenRequest.mockRejectedValue(new Error('Refresh failed'));

        Object.defineProperty(window, 'location', {
            value: { href: '/' }, writable: true,
        });

        try { await api.get('/patients'); } catch {}

        expect(window.location.href).toBe('/');
    });
});

describe('Response interceptor — non-401 errors', () => {

    it('rejects with error on 404', async () => {
        mockAxios.onGet('/patients/999').reply(404, { message: 'Not found' });

        await expect(api.get('/patients/999')).rejects.toThrow();
        expect(refreshTokenRequest).not.toHaveBeenCalled();
    });

    it('rejects with error on 500', async () => {
        mockAxios.onGet('/patients').reply(500, { message: 'Server error' });

        await expect(api.get('/patients')).rejects.toThrow();
        expect(refreshTokenRequest).not.toHaveBeenCalled();
    });
});