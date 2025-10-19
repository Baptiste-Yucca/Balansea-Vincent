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
    index: true,
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
    default: -8, // Pyth utilise des exposants
  },
} as const;

const PriceDataSchema = new Schema(priceDataSchemaDefinition, { timestamps: false });

// Index composé pour les requêtes de prix
PriceDataSchema.index({ assetId: 1, timestamp: -1 });
PriceDataSchema.index({ timestamp: -1 });

// TTL pour nettoyer les anciens prix (garder 30 jours)
PriceDataSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const PriceData = model('PriceData', PriceDataSchema);
