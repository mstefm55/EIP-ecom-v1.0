import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const configuredFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfig.measurementId || '',
};

const isFirebaseConfigured = Boolean(
  configuredFirebaseConfig.apiKey &&
  configuredFirebaseConfig.authDomain &&
  configuredFirebaseConfig.projectId &&
  configuredFirebaseConfig.appId
);

// Initialize Firebase App and Auth only when the operator has provided env-backed config.
const app = isFirebaseConfigured ? initializeApp(configuredFirebaseConfig) : null;
const auth = app ? getAuth(app) : null;

const provider = auth ? new GoogleAuthProvider() : null;
// Request Google Drive scopes
if (provider) {
  provider.addScope('https://www.googleapis.com/auth/drive');
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.addScope('https://www.googleapis.com/auth/drive.readonly');
  provider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');
}

// Caching variables
let isSigningIn = false;
let cachedAccessToken = null;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess,
  onAuthFailure
) => {
  if (!auth) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If there's a user but no cached token, they might have refreshed.
        // Since we can't get the OAuth token silently from Firebase Auth without re-authenticating,
        // we'll flag that auth is required for Google Drive features specifically.
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Initiate Google Sign-In pop-up
export const googleSignIn = async () => {
  if (!auth || !provider) {
    throw new Error('Google Drive auth is not configured. Set the VITE_FIREBASE_* environment variables before enabling this feature.');
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Retrieve cached access token
export const getAccessToken = () => {
  return cachedAccessToken;
};

// Sign out
export const logout = async () => {
  if (!auth) return;
  await auth.signOut();
  cachedAccessToken = null;
};

/**
 * GOOGLE DRIVE REST API HELPERS
 */

// Save a measurements ledger or design data to Google Drive
export const saveJsonToDrive = async (jsonData, filename) => {
  const token = getAccessToken();
  if (!token) {
    throw new Error('No active Google session. Please sign in again.');
  }

  const metadata = {
    name: filename,
    mimeType: 'application/json',
    description: 'Perfect Fit Bureau custom sewing measurements ledger',
  };

  const boundary = 'perfectfit_bureau_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const body =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(jsonData) +
    closeDelim;

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: body,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to save to Google Drive: ${errText}`);
  }

  return await response.json();
};

// Save a plain text report to Google Drive
export const saveTextToDrive = async (textContent, filename) => {
  const token = getAccessToken();
  if (!token) {
    throw new Error('No active Google session. Please sign in again.');
  }

  const metadata = {
    name: filename,
    mimeType: 'text/markdown',
    description: 'Perfect Fit Bureau pattern and sizing report',
  };

  const boundary = 'perfectfit_bureau_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const body =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: text/markdown; charset=UTF-8\r\n\r\n' +
    textContent +
    closeDelim;

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: body,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to save report to Google Drive: ${errText}`);
  }

  return await response.json();
};

// List files in Google Drive that were created by the app
export const listAppFilesFromDrive = async () => {
  const token = getAccessToken();
  if (!token) {
    throw new Error('No active Google session. Please sign in again.');
  }

  // Filter files containing 'perfectfit_bureau' in their name
  const query = encodeURIComponent("name contains 'perfectfit_bureau' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&fields=files(id,name,mimeType,modifiedTime,size)`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to list files from Google Drive: ${errText}`);
  }

  const data = await response.json();
  return data.files || [];
};

// Read JSON file contents from Google Drive
export const readJsonFromDrive = async (fileId) => {
  const token = getAccessToken();
  if (!token) {
    throw new Error('No active Google session. Please sign in again.');
  }

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to read file from Google Drive: ${errText}`);
  }

  return await response.json();
};

// Delete a file from Google Drive (with confirmation from caller)
export const deleteFileFromDrive = async (fileId) => {
  const token = getAccessToken();
  if (!token) {
    throw new Error('No active Google session. Please sign in again.');
  }

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to delete file from Google Drive: ${errText}`);
  }

  return true;
};
