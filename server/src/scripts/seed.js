import dotenv from 'dotenv';
dotenv.config();

import { connectDB, disconnectDB } from '../config/db.js';
import { LoanScheme } from '../models/LoanScheme.js';
import { DEFAULT_LOAN_SCHEMES } from '../config/constants.js';

export async function seedLoanSchemes() {
  console.log('[Seed] Seeding loan schemes into MongoDB...');

  for (const scheme of DEFAULT_LOAN_SCHEMES) {
    await LoanScheme.findOneAndUpdate(
      { planId: scheme.planId },
      { $set: scheme },
      { upsert: true, new: true }
    );
    console.log(`[Seed] Seeded plan: ${scheme.planId} (${scheme.name})`);
  }

  console.log('[Seed] Loan schemes seeded successfully.');
}

// Auto-run if executed directly via CLI
if (process.argv[1]?.endsWith('seed.js')) {
  (async () => {
    try {
      await connectDB();
      await seedLoanSchemes();
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error('[Seed Error]:', err.message);
      process.exit(1);
    }
  })();
}
