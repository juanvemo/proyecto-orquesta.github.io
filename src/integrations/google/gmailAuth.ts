import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type Auth,
  type User,
} from "firebase/auth";
import firebaseConfig from "../../../firebase-applet-config.json";

export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"] as const;

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;
let isSigningIn = false;

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

function getFirebaseAuthInstance(): Auth {
  if (!cachedApp) {
    cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  if (!cachedAuth) {
    cachedAuth = getAuth(cachedApp);
    onAuthStateChanged(cachedAuth, (user) => {
      cachedUser = user;
      if (!user && !isSigningIn) {
        cachedAccessToken = null;
      }
      notifyListeners();
    });
  }
  return cachedAuth;
}

export function subscribeGmailAuthState(listener: () => void): () => void {
  getFirebaseAuthInstance();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getGmailAuthSnapshot(): { user: User | null; hasToken: boolean; email: string | null } {
  getFirebaseAuthInstance();
  return {
    user: cachedUser,
    hasToken: Boolean(cachedAccessToken),
    email: cachedUser?.email ?? null,
  };
}

export function getGmailAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearGmailAccessToken(): void {
  cachedAccessToken = null;
  notifyListeners();
}

export async function connectGmailAccount(): Promise<{ user: User; accessToken: string }> {
  const auth = getFirebaseAuthInstance();
  const provider = new GoogleAuthProvider();
  GMAIL_SCOPES.forEach((scope) => provider.addScope(scope));
  provider.setCustomParameters({ prompt: "select_account consent" });

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("No se recibió el token de acceso de Google para enviar correos con Gmail.");
    }
    cachedUser = result.user;
    cachedAccessToken = credential.accessToken;
    notifyListeners();
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function disconnectGmailAccount(): Promise<void> {
  const auth = getFirebaseAuthInstance();
  cachedAccessToken = null;
  cachedUser = null;
  await auth.signOut();
  notifyListeners();
}
