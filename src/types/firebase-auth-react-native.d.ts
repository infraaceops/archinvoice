import type { Persistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: typeof AsyncStorage): Persistence;
}
