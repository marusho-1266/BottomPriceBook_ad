import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

const useEmulators = import.meta.env.VITE_FIREBASE_USE_EMULATORS === 'true';

const firebaseConfig = useEmulators
  ? {
      // エミュレータ用のデモプロジェクト。実際のリソースには接続しない
      apiKey: 'demo-api-key',
      authDomain: 'demo-sokoneko.firebaseapp.com',
      projectId: 'demo-sokoneko',
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    };

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// オフライン永続化: 一度読んだデータを端末に保持し、オフラインでも閲覧・記録できる(M-4)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// Issue #13: アカウント削除(退会)用の Callable Function
export const functions = getFunctions(app, 'asia-northeast1');

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}
