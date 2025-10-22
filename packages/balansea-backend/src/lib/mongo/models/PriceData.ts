import { Schema, model } from 'mongoose';

const priceDataSchemaDefinition = {
  assetId: {
    required: true,
    type: Schema.Types.ObjectId,
    ref: 'Asset',
    index: true,
  },
  priceUSD: {
    required: true,
    type: Number,
    min: 0,
  },
  timestamp: {
    required: true,
    type: Date,
  },
  source: {
    type: String,
    enum: ['pyth', 'manual', 'coingecko'],
    default: 'pyth',
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
  },
  expo: {
    type: Number,
    default: -8, // Pyth uses exponents
  },
} as const;

const PriceDataSchema = new Schema(priceDataSchemaDefinition, { timestamps: false });

// Composite index for price queries
PriceDataSchema.index({ assetId: 1, timestamp: -1 });
PriceDataSchema.index({ timestamp: -1 });

// TTL to clean up old prices (keep 30 days)
PriceDataSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const PriceData = model('PriceData', PriceDataSchema);
