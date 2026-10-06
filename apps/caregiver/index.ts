import { registerRootComponent } from 'expo';
import App from './App';
// Defines the visit-location background task at startup; it must exist before the OS can run it.
import './src/supply/backgroundLocationTask';

registerRootComponent(App);