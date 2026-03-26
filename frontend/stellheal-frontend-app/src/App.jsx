import React from 'react';
import AppRouter from './router/routes';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ukUA, enUS } from '@mui/x-date-pickers/locales';

function App() {
    const { i18n } = useTranslation();
    const locale = i18n.language === 'uk' ? ukUA : enUS;

    const theme = createTheme(
        {
            typography: {
                fontFamily: 'Arial, sans-serif',
            },
        },
        locale
    );

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <AppRouter />
        </ThemeProvider>
    );
}

export default App;
