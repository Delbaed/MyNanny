import { getApp, getApps, initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.databaseURL) {
  throw new Error(
    'Missing EXPO_PUBLIC_FIREBASE_DATABASE_URL. Copy app/.env.example to app/.env and fill in your Firebase project values.'
  );
}

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getDatabase(firebaseApp);

// firebase@12 dropped the getReactNativePersistence helper, so this session
// is in-memory only: a fresh anonymous identity every cold start. Harmless
// for a read-only viewer (rules only require auth != null to read), just
// means the Firebase Auth user list accumulates one entry per app install.
export const auth = getAuth(firebaseApp);

// database.rules.json requires auth != null to read. The app doesn't need a
// real account for this — anyone who can install the app is allowed to view
// it — so a plain anonymous session is enough to satisfy the rule.
export const authReady = signInAnonymously(auth);
