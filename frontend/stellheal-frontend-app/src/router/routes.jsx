import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from '../pages/Login/Login';
import MainPage from '../pages/MainPage/MainPage';
import ProfilePage from '../pages/ProfilePage/ProfilePage';
import PatientsPage from '../pages/PatientsPage/PatientsPage';
import StaffPage from '../pages/StaffPage/StaffPage';
import DevicesPage from '../pages/DevicesPage/DevicesPage';
import StatsPage from '../pages/StatsPage/StatsPage';
import BackupPage from '../pages/BackupPage/BackupPage';
import PatientDetailsPage from "../pages/PatientDetailsPage/PatientDetailsPage.jsx";
import ResetPasswordPage from "../pages/ResetPasswordPage/ResetPasswordPage.jsx";

export default function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/main" element={<MainPage />}>
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="patients" element={<PatientsPage />} />
                    <Route path="staff" element={<StaffPage />} />
                    <Route path="devices" element={<DevicesPage />} />
                    <Route path="stats" element={<StatsPage />} />
                    <Route path="backup" element={<BackupPage />} />
                    <Route path="patients/:id" element={<PatientDetailsPage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
