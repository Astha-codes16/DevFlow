import mongoose from 'mongoose';

let memoryServer = null;

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devflow';

  try {
    // Attempt standard connection with 2.5s server selection timeout
    console.log('Connecting to MongoDB');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2500,
    });
    console.log('MongoDB connected successfully via URI');
  } catch (primaryErr) {
    const allowMemoryFallback = process.env.NODE_ENV === 'test' || process.env.USE_IN_MEMORY_DB === 'true';
    if (!allowMemoryFallback) {
      throw new Error('MongoDB connection failed and in-memory fallback is disabled');
    }

    console.warn('MongoDB connection failed. Starting explicitly enabled in-memory MongoDB.');
    
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      const memUri = memoryServer.getUri();
      console.log(`Embedded MongoDB launched at: ${memUri}`);
      
      await mongoose.connect(memUri);
      console.log('Connected to embedded In-Memory MongoDB successfully.');
    } catch (memErr) {
      throw new Error('Failed to initialize explicitly enabled in-memory MongoDB');
    }
  }
};

export const closeDB = async () => {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
};
