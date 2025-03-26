import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as RNLocalize from 'react-native-localize';

const resources = {
  en: {
    translation: {
      welcome: 'Welcome to Chumzr',
      home: 'Home',
      inbox: 'Inbox',
      favorite: 'Favorite',
      profile: 'Profile',
      device_id: 'Device ID',
      get_started: 'Get Started',
      select_language: 'Select your language',
      logout: 'Log Out',
      logout_confirm: 'Are you sure you want to log out?',
      cancel: 'Cancel',
      error: 'Error',
      logout_error: 'Failed to log out. Please try again.',
    },
  },
  hi: {
    translation: {
      welcome: 'चमज़र में आपका स्वागत है',
      home: 'होम',
      inbox: 'इनबॉक्स',
      favorite: 'पसंदीदा',
      profile: 'प्रोफ़ाइल',
      device_id: 'डिवाइस आईडी',
      get_started: 'शुरू करें',
      select_language: 'अपनी भाषा चुनें',
      logout: 'लॉग आउट',
      logout_confirm: 'क्या आप लॉग आउट करना चाहते हैं?',
      cancel: 'रद्द करें',
      error: 'त्रुटि',
      logout_error: 'लॉग आउट करने में विफल। कृपया पुनः प्रयास करें।',
    },
    es: {
      translation: {
        welcome: 'Bienvenido a Chumzr',
        home: 'Inicio',
        inbox: 'Bandeja de entrada',
        favorite: 'Favorito',
        profile: 'Perfil',
        device_id: 'ID del dispositivo',
        get_started: 'Comenzar',
        select_language: 'Seleccionar tu idioma',
        logout: 'Cerrar sesión',
        logout_confirm: '¿Estás seguro de querer cerrar sesión?',
        cancel: 'Cancelar',
        error: 'Error',
        logout_error: 'Error al cerrar sesión. Por favor, inténtelo de nuevo.',
      },
    },
  },
};

// Get the supported languages
const supportedLocales = Object.keys(resources);
const userPreferredLocales = RNLocalize.getLocales().map(locale => locale.languageCode);

// Find the best matching language
let bestLanguage = 'en'; // Default fallback
for (const locale of userPreferredLocales) {
  if (supportedLocales.includes(locale)) {
    bestLanguage = locale;
    break;
  }
}

i18n.use(initReactI18next).init({
  resources,
  lng: bestLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n; 