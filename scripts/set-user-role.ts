import { getAdminAuth } from '../src/firebaseAdmin';

async function main() {
  const [, , email, role] = process.argv;

  if (!email || !role) {
    console.error('Usage: ts-node scripts/set-user-role.ts <email> <role>');
    process.exit(1);
  }

  try {
    const adminAuth = getAdminAuth();
    const user = await adminAuth.getUserByEmail(email);
    await adminAuth.setCustomUserClaims(user.uid, { role });
    await adminAuth.revokeRefreshTokens(user.uid);

    console.log(`Set role "${role}" for ${email} (uid: ${user.uid}).`);
    console.log('Existing sessions were revoked; the user must sign in again.');
  } catch (error) {
    console.error('Failed to set role:', error);
    process.exit(1);
  }
}

void main();
