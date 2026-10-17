// Firebase: Authentication for accounts, Firestore for passports, consent, decisions and the audit log.
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore'

const env = import.meta.env
export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'demo-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? `${env.VITE_FIREBASE_PROJECT_ID ?? 'demo-kosha'}.firebaseapp.com`,
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'demo-kosha',
  appId: env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true })

// Local development and tests run against the Firebase emulators.
if (env.VITE_FIREBASE_EMULATORS === '1') {
  const host = location.hostname
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
  connectFirestoreEmulator(db, host, 8180)
}
