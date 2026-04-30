import { createContext, useContext, useState, useEffect } from "react";
import { loginUser } from "../services/authService";
import api from "../utils/api.js";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(localStorage.getItem("accessToken"));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedUser = localStorage.getItem("user");
        if (savedUser && accessToken) {
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        const data = await loginUser(email, password);

        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        localStorage.setItem("user", JSON.stringify(data.user));

        setAccessToken(data.accessToken);
        setUser(data.user);
    };

    const logout = async () => {
        const refreshToken = localStorage.getItem("refreshToken");

        try {
            await api.post("/auth/logout", { refreshToken });
        } catch (e) {
            console.log("Logout error:", e);
        }

        localStorage.clear();
        setUser(null);
        setAccessToken(null);

        window.location.href = "/";
    };

    return (
        <AuthContext.Provider value={{
            user,
            setUser,
            accessToken,
            login,
            logout,
            loading
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);