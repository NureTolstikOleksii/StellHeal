import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'
import './i18n';
import { AuthProvider } from './context/AuthContext';

createRoot(document.getElementById('root')).render(
    <AuthProvider>
        <App />
    </AuthProvider>
)