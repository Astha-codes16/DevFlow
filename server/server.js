import dotenv from 'dotenv';
dotenv.config();

import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import { assertProductionSecurityConfig } from './src/config/security.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log('--- Starting DevFlow AI Server ---');
    assertProductionSecurityConfig();
    await connectDB();

    app.listen(PORT, () => {
      console.log(`🚀 DevFlow AI Backend running on http://localhost:${PORT}`);
      console.log(`📡 Health check available at: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
