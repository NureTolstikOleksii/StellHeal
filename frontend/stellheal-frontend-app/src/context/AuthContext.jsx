import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { loginUser } from "../services/authService";
import api from "../utils/api.js";

const AuthContext = createContext();

const INACTIVITY_TIMEOUT  = 30 * 60 * 1000;
const WARNING_BEFORE      =  2 * 60 * 1000;
const ACTIVITY_EVENTS     = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

export const AuthProvider = ({ children }) => {
    const [user, setUser]               = useState(null);
    const [accessToken, setAccessToken] = useState(localStorage.getItem("accessToken"));
    const [loading, setLoading]         = useState(true);
    const [showWarning, setShowWarning] = useState(false); // показувати попередження про логаут
    const [countdown, setCountdown]     = useState(120);  // відлік секунд у попередженні

    const inactivityTimer = useRef(null);
    const warningTimer    = useRef(null);
    const countdownTimer  = useRef(null);

    useEffect(() => {
        const savedUser = localStorage.getItem("user");
        if (savedUser && accessToken) {
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    const logout = useCallback(async (silent = false) => {
        clearAllTimers();

        if (!silent) {
            const refreshToken = localStorage.getItem("refreshToken");
            try {
                await api.post("/auth/logout", { refreshToken });
            } catch (e) {
                console.log("Logout error:", e);
            }
        }

        localStorage.clear();
        setUser(null);
        setAccessToken(null);
        setShowWarning(false);
        window.location.href = "/";
    }, []);

    const clearAllTimers = () => {
        clearTimeout(inactivityTimer.current);
        clearTimeout(warningTimer.current);
        clearInterval(countdownTimer.current);
    };

    const resetInactivityTimer = useCallback(() => {
        if (!localStorage.getItem("accessToken")) return;

        clearAllTimers();
        setShowWarning(false);

        warningTimer.current = setTimeout(() => {
            setShowWarning(true);
            setCountdown(120);

            countdownTimer.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(countdownTimer.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }, INACTIVITY_TIMEOUT - WARNING_BEFORE);

        inactivityTimer.current = setTimeout(() => {
            logout(true);
        }, INACTIVITY_TIMEOUT);

    }, [logout]);

    useEffect(() => {
        if (!user) return;

        resetInactivityTimer();

        ACTIVITY_EVENTS.forEach(event =>
            window.addEventListener(event, resetInactivityTimer, { passive: true })
        );

        return () => {
            clearAllTimers();
            ACTIVITY_EVENTS.forEach(event =>
                window.removeEventListener(event, resetInactivityTimer)
            );
        };
    }, [user, resetInactivityTimer]);

    const login = async (email, password) => {
        const data = await loginUser(email, password);

        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        localStorage.setItem("user", JSON.stringify(data.user));

        setAccessToken(data.accessToken);
        setUser(data.user);
    };

    const extendSession = () => {
        setShowWarning(false);
        resetInactivityTimer();
    };

    return (
        <AuthContext.Provider value={{
            user,
            setUser,
            accessToken,
            login,
            logout,
            loading,
            showWarning,
            countdown,
            extendSession,
        }}>
            {children}

            {showWarning && (
                <div style={{
                    position:        'fixed',
                    top:             0,
                    left:            0,
                    right:           0,
                    bottom:          0,
                    background:      'rgba(0,0,0,0.5)',
                    zIndex:          99999,
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                }}>
                    <div style={{
                        background:    '#fff',
                        borderRadius:  12,
                        padding:       '32px 40px',
                        maxWidth:      420,
                        width:         '90%',
                        textAlign:     'center',
                        boxShadow:     '0 8px 32px rgba(0,0,0,0.2)',
                    }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>⏱️</div>
                        <h3 style={{ margin: '0 0 8px', fontSize: 20, color: '#1a1a2e' }}>
                            Сесія завершується
                        </h3>
                        <p style={{ color: '#666', margin: '0 0 8px', fontSize: 15 }}>
                            Через неактивність ви будете автоматично виведені із системи.
                        </p>
                        <div style={{
                            fontSize:      36,
                            fontWeight:    700,
                            color:         countdown <= 30 ? '#e53935' : '#1976d2',
                            margin:        '12px 0 24px',
                        }}>
                            {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                        </div>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            <button
                                onClick={extendSession}
                                style={{
                                    background:   '#1976d2',
                                    color:        '#fff',
                                    border:       'none',
                                    borderRadius: 8,
                                    padding:      '10px 24px',
                                    fontSize:     15,
                                    cursor:       'pointer',
                                    fontWeight:   600,
                                }}
                            >
                                Продовжити роботу
                            </button>
                            <button
                                onClick={() => logout()}
                                style={{
                                    background:   'transparent',
                                    color:        '#666',
                                    border:       '1px solid #ddd',
                                    borderRadius: 8,
                                    padding:      '10px 24px',
                                    fontSize:     15,
                                    cursor:       'pointer',
                                }}
                            >
                                Вийти зараз
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);