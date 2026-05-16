// =============================================================================
// generateHashes.ts
//
// Produces bcrypt hashes (saltRounds=10, matching auth.service.ts) for the
// seed passwords used in migration 009_reseed_all_data.sql. SQL has no
// native bcrypt, so this script prints the hashes and we paste them into
// the migration.
//
// Run with:   npx ts-node backend/scripts/generateHashes.ts
//             (or)  npx tsx  backend/scripts/generateHashes.ts
// =============================================================================

import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

// Citizen passwords are per-account (10 distinct). Mukhtar and officer
// share a single password each.
const PASSWORDS: ReadonlyArray<{ label: string; password: string }> = [
  { label: 'Safi',     password: 'Safi123!' },
  { label: 'Mahmoud',  password: 'Mahmoud123!' },
  { label: 'Jad',      password: 'Jad123!' },
  { label: 'Yasser',   password: 'Yasser123!' },
  { label: 'Makram',   password: 'Makram123!' },
  { label: 'Houssam',  password: 'Houssam123!' },
  { label: 'Wael',     password: 'Wael123!' },
  { label: 'Joel',     password: 'Joel123!' },
  { label: 'Rena',     password: 'Rena123!' },
  { label: 'Khaled',   password: 'Khaled123!' },
  { label: 'Mukhtar',  password: 'Mukhtar123!' },
  { label: 'Officer',  password: 'Officer123!' },
];

async function main(): Promise<void> {
  for (const { label, password } of PASSWORDS) {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    console.log(`${label.padEnd(10)} | ${password.padEnd(14)} | ${hash}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
