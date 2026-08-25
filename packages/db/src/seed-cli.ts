/**
 * `pnpm db:seed <email>` — seeds defaults and sample content for an existing user.
 * The user row itself is created by the Google OAuth callback; this is for reseeding.
 */

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { getDatabase } from './client.js';
import { users } from './schema.js';
import { seedUser } from './seed.js';

const email = process.argv[2];
if (!email) {
  console.error('Pakai: pnpm db:seed <email>');
  process.exit(1);
}

const db = getDatabase();
const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
if (!user) {
  console.error(`Pengguna ${email} belum ada. Login lewat Google dulu.`);
  process.exit(1);
}

await seedUser(db, user.id);
console.log(`Seed selesai untuk ${email}.`);
