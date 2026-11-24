/* One Firebase client for the header and My Page; never initialize two default apps.
 * No Firebase SDK is downloaded unless a real public web-app config is present. */
import { firebaseConfig } from "./firebase-config.js";

const configured = Boolean(firebaseConfig?.apiKey && firebaseConfig?.authDomain &&
  firebaseConfig?.projectId && firebaseConfig?.appId);
let authPromise = null;
let accountPromise = null;
export function isFirebaseConfigured() { return configured; }

export function getFirebaseAuthServices() {
  if (!configured) return Promise.resolve(null);
  if (!authPromise) {
    authPromise = Promise.all([
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js")
    ]).then(([appSdk, authSdk]) => {
      const app = appSdk.getApps().find(item => item.name === "[DEFAULT]") ||
        appSdk.initializeApp(firebaseConfig);
      return { app, auth: authSdk.getAuth(app), authSdk };
    }).catch(error => { authPromise = null; throw error; });
  }
  return authPromise;
}

export function getFirebaseAccountServices() {
  if (!configured) return Promise.resolve(null);
  if (!accountPromise) {
    accountPromise = Promise.all([
      getFirebaseAuthServices(),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js")
    ]).then(([base, firestoreSdk]) => ({
      ...base, db: firestoreSdk.getFirestore(base.app), firestoreSdk
    })).catch(error => { accountPromise = null; throw error; });
  }
  return accountPromise;
}
