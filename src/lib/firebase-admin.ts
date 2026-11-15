import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const adminApp = getApps().length
  ? getApp()
  : initializeApp({
      credential: process.env.FIREBASE_CLIENT_EMAIL
        ? cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(
              /\\n/g,
              "\n"
            ),
          })
        : applicationDefault(),
    });

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);