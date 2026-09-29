import mongoose from 'mongoose';

let memoryServer = null;

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devflow';

  try {
    // Attempt standard connection with 2.5s server selection timeout
    console.log(`Connecting to MongoDB at: ${uri}`);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2500,
    });
    console.log('MongoDB connected successfully via URI');
  } catch (primaryErr) {
    console.warn(`Could not connect to MongoDB URI (${primaryErr.message}). Launching embedded In-Memory MongoDB...`);
    
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      const memUri = memoryServer.getUri();
      console.log(`Embedded MongoDB launched at: ${memUri}`);
      
      await mongoose.connect(memUri);
      console.log('Connected to embedded In-Memory MongoDB successfully.');
      
      // Auto-seed demo data if running in memory
      const { seedDatabase } = await import('../utils/seedData.js');
      await seedDatabase();
    } catch (memErr) {
      console.error('Failed to initialize embedded MongoDB:', memErr.message);
      throw memErr;
    }
  }
};

export const closeDB = async () => {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
};
