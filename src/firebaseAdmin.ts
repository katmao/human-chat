import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'node:fs';
import path from 'node:path';

type ServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function loadServiceAccount(): ServiceAccount {
  if (process.env.FIREBASE_ADMIN_CREDENTIAL) {
    return JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIAL) as ServiceAccount;
  }

  const localPath = path.resolve(process.cwd(), 'serviceAccount.json');
  if (process.env.NODE_ENV !== 'production' && fs.existsSync(localPath)) {
    return JSON.parse(fs.readFileSync(localPath, 'utf-8')) as ServiceAccount;
  }

  throw new Error(
    'Missing Firebase admin credentials. Set FIREBASE_ADMIN_CREDENTIAL env var with service account JSON.'
  );
}

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(loadServiceAccount()),
      });

const adminAuth = getAuth(app);

export { adminAuth };
