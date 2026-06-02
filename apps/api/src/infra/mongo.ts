import mongoose from 'mongoose';

import { loadEnv } from '../config/env.js';
import { logger } from '../config/logger.js';

const env = loadEnv();

mongoose.set('strictQuery', true);
mongoose.set('sanitizeFilter', true);

export async function connectMongo(uri: string = env.MONGO_URI): Promise<typeof mongoose> {
  mongoose.connection.on('connected', () => logger.info('mongo connected'));
  mongoose.connection.on('disconnected', () => logger.warn('mongo disconnected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'mongo error'));
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5_000,
    autoIndex: env.NODE_ENV !== 'production',
  });
  return mongoose;
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
