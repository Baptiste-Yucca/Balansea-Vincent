import mongoose from 'mongoose';

import { serviceLogger } from '../logger';
import { AssetService } from '../services';

/**
 * Connects to MongoDB using the provided connection string
 *
 * @param mongoUri MongoDB connection URI
 * @returns A promise that resolves when connected successfully
 */
export async function connectToMongoDB(mongoUri: string): Promise<mongoose.Connection> {
  serviceLogger.info(`Connecting to MongoDB @ ${mongoUri}`);

  await mongoose.connect(mongoUri);
  serviceLogger.info('Connected to MongoDB');

  // Initialiser les assets par défaut
  try {
    await AssetService.initializeDefaultAssets();
    serviceLogger.info('Default assets initialized');
  } catch (error) {
    serviceLogger.error('Failed to initialize default assets:', error);
  }

  return mongoose.connection;
}
