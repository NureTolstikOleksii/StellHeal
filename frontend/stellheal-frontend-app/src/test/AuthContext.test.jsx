import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext.jsx';


vi.mock('../services/authService.js', () => ({
    loginUser: vi.fn(),
}));

vi.mock('../utils/api.js', () => ({
    default: { post: vi.fn() }
}));

import { loginUser } from '../services/authService.js';
import api from '../utils/api.js';

const TestComponent = () => {
    const { user, loading, showWarning, countdown, login, logout, extendSession } = useAuth();
    return (
        <div>
            <div data-testid="loading">{String(loading)}</div>
            <div data-testid="user">{user ? JSON.stringify(user) : 'null'}</div>
            <div data-testid="showWarning">{String(showWarning)}</div>
            <div data-testid="countdown">{countdown}</div>
            <button onClick={() => login('doctor@test.com', 'pass')} data-testid="loginBtn">Login</button>
            <button onClick={() => logout()} data-testid="logoutBtn">Logout</button>
            <button onClick={() => logout(true)} data-testid="silentLogoutBtn">Silent Logout</button>
            <button onClick={extendSession} data-testid="extendBtn">Extend</button>
        </div>
    );
};

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
});

afterEach(() => {
    localStorage.clear();
});

describe('AuthProvider — initial state', () => {

    it('loading is false after mount', async () => {
        render(<AuthProvider><TestComponent /></AuthProvider>);
        await waitFor(() => {
            expect(screen.getByTestId('loading').textContent).toBe('false');
        });
    });

    it('user is null when localStorage is empty', async () => {
        render(<AuthProvider><TestComponent /></AuthProvider>);
        await waitFor(() => {
            expect(screen.getByTestId('user').textContent).toBe('null');
        });
    });

    it('restores user from localStorage on mount', async () => {
        const mockUser = { id: 1, role: 'admin' };
        localStorage.setItem('user', JSON.stringify(mockUser));
        localStorage.setItem('accessToken', 'token123');

        render(<AuthProvider><TestComponent /></AuthProvider>);
        await waitFor(() => {
            expect(screen.getByTestId('user').textContent).toContain('"id":1');
        });
    });

    it('showWarning is false initially', async () => {
        render(<AuthProvider><TestComponent /></AuthProvider>);
        await waitFor(() => {
            expect(screen.getByTestId('showWarning').textContent).toBe('false');
        });
    });
});

describe('login', () => {

    it('saves tokens and user to localStorage', async () => {
        loginUser.mockResolvedValue({
            accessToken:  'access123',
            refreshToken: 'refresh456',
            user: { id: 1, role: 'admin' }
        });

        render(<AuthProvider><TestComponent /></AuthProvider>);
        await act(async () => {
            fireEvent.click(screen.getByTestId('loginBtn'));
        });

        expect(localStorage.getItem('accessToken')).toBe('access123');
        expect(localStorage.getItem('refreshToken')).toBe('refresh456');
    });

    it('sets user state after successful login', async () => {
        loginUser.mockResolvedValue({
            accessToken:  'access123',
            refreshToken: 'refresh456',
            user: { id: 1, role: 'admin' }
        });

        render(<AuthProvider><TestComponent /></AuthProvider>);
        await act(async () => {
            fireEvent.click(screen.getByTestId('loginBtn'));
        });

        await waitFor(() => {
            expect(screen.getByTestId('user').textContent).toContain('"id":1');
        });
    });
});

describe('logout', () => {

    it('clears localStorage on logout', async () => {
        localStorage.setItem('accessToken', 'token123');
        localStorage.setItem('refreshToken', 'refresh456');
        api.post.mockResolvedValue({});

        render(<AuthProvider><TestComponent /></AuthProvider>);
        await act(async () => {
            fireEvent.click(screen.getByTestId('logoutBtn'));
        });

        expect(localStorage.getItem('accessToken')).toBeNull();
        expect(localStorage.getItem('refreshToken')).toBeNull();
    });

    it('calls API logout when not silent', async () => {
        localStorage.setItem('refreshToken', 'refresh456');
        api.post.mockResolvedValue({});

        render(<AuthProvider><TestComponent /></AuthProvider>);
        await act(async () => {
            fireEvent.click(screen.getByTestId('logoutBtn'));
        });

        expect(api.post).toHaveBeenCalledWith(
            '/auth/logout',
            { refreshToken: 'refresh456' }
        );
    });

    it('does NOT call API on silent logout', async () => {
        localStorage.setItem('refreshToken', 'refresh456');

        render(<AuthProvider><TestComponent /></AuthProvider>);
        await act(async () => {
            fireEvent.click(screen.getByTestId('silentLogoutBtn'));
        });

        expect(api.post).not.toHaveBeenCalled();
    });
});

describe('inactivity timer', () => {

    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('showWarning appears after 28 minutes of inactivity', async () => {
        localStorage.setItem('accessToken', 'token123');
        localStorage.setItem('user', JSON.stringify({ id: 1, role: 'admin' }));

        render(<AuthProvider><TestComponent /></AuthProvider>);

        await waitFor(() => {
            expect(screen.getByTestId('user').textContent).toContain('"id":1');
        }, { timeout: 3000 });

        act(() => {
            vi.advanceTimersByTime(28 * 60 * 1000);
        });

        await waitFor(() => {
            expect(screen.getByTestId('showWarning').textContent).toBe('true');
        }, { timeout: 3000, interval: 100 });
    }, 15000);

    it('extendSession hides warning and resets timer', async () => {
        localStorage.setItem('accessToken', 'token123');
        localStorage.setItem('user', JSON.stringify({ id: 1, role: 'admin' }));

        render(<AuthProvider><TestComponent /></AuthProvider>);

        await waitFor(() => {
            expect(screen.getByTestId('user').textContent).toContain('"id":1');
        }, { timeout: 3000 });

        act(() => {
            vi.advanceTimersByTime(28 * 60 * 1000);
        });

        await waitFor(() => {
            expect(screen.getByTestId('showWarning').textContent).toBe('true');
        }, { timeout: 3000, interval: 100 });

        await act(async () => {
            fireEvent.click(screen.getByTestId('extendBtn'));
        });

        expect(screen.getByTestId('showWarning').textContent).toBe('false');
    }, 15000);
});