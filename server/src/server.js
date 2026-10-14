import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { seedLoanSchemes } from './scripts/seed.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();

    // Auto-seed required loan schemes
    await seedLoanSchemes();

    const app = createApp();

    const server = app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`  🚀 Gold Loan Portal Backend Server running on port ${PORT}`);
      console.log(`  📡 API Base URL: http://localhost:${PORT}/api/v1`);
      console.log(`  🤖 AI Agent Chat: http://localhost:${PORT}/api/v1/chat`);
      console.log(`=======================================================`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received. Closing HTTP server...');
      server.close(() => {
        console.log('HTTP server closed.');
      });
    });
  } catch (error) {
    console.error(`[Server Initialization Error]: ${error.message}`);
    process.exit(1);
  }
}

startServer();
