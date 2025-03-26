/**
 * @format
 */

// Silence React Native Firebase deprecation warnings
globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
