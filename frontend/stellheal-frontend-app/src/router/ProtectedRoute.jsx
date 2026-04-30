import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children }) => {
    const { accessToken, loading } = useAuth();

    if (loading) return null;

    if (!accessToken) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default ProtectedRoute;