import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from '../pages/Login/Login';
import MainPage from '../pages/MainPage/MainPage';
import ProfilePage from '../pages/ProfilePage/ProfilePage';
import PatientsPage from '../pages/PatientsPage/PatientsPage';
import StaffPage from '../pages/StaffPage/StaffPage';
import DevicesPage from '../pages/DevicesPage/DevicesPage';
import WardsPage from '../pages/WardsPage/WardsPage';
import StatsPage from '../pages/StatsPage/StatsPage';
import BackupPage from '../pages/BackupPage/BackupPage';
import PatientDetailsPage from '../pages/PatientDetailsPage/PatientDetailsPage.jsx';
import ResetPasswordPage from '../pages/ResetPasswordPage/ResetPasswordPage.jsx';
import CreatePrescriptionPage from '../pages/CreatePrescriptionPage/CreatePrescriptionPage.jsx';
import PatientFilesPage from '../pages/PatientFilesPage/PatientFilesPage.jsx';
import EditPrescriptionPage from '../pages/EditPrescriptionPage/EditPrescriptionPage.jsx';
import PatientIntakePage from '../pages/PatientIntakePage/PatientIntakePage.jsx';

import ProtectedRoute from './ProtectedRoute.jsx';

export default function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>

                {/* Публічні */}
                <Route path="/" element={<Login />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Приватні */}
                <Route
                    path="/main"
                    element={
                        <ProtectedRoute>
                            <MainPage />
                        </ProtectedRoute>
                    }
                >
                    <Route path="profile"  element={<ProfilePage />} />
                    <Route path="patients" element={<PatientsPage />} />
                    <Route path="staff"    element={<StaffPage />} />
                    <Route path="devices"  element={<DevicesPage />} />
                    <Route path="wards"    element={<WardsPage />} />
                    <Route path="stats"    element={<StatsPage />} />
                    <Route path="backup"   element={<BackupPage />} />

                    <Route path="patients/:id"                                          element={<PatientDetailsPage />} />
                    <Route path="patients/:id/prescription/new"                         element={<CreatePrescriptionPage />} />
                    <Route path="patients/:id/files"                                    element={<PatientFilesPage />} />
                    <Route path="patients/:id/prescription/:prescriptionId/edit"        element={<EditPrescriptionPage />} />
                    <Route path="patients/:id/intake/:prescriptionId"                   element={<PatientIntakePage />} />
                </Route>

            </Routes>
        </BrowserRouter>
    );
}