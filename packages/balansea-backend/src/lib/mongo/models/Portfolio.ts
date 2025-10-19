import { Schema, model } from 'mongoose';

const portfolioSchemaDefinition = {
  ethAddress: {
    required: true,
    type: String,
    lowercase: true,
    match: /^0x[a-fA-F0-9]{40}$/,
    index: true,
  },
  name: {
    required: true,
    type: String,
    maxlength: 100,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  rebalanceThreshold: {
    required: true,
    type: Number,
    min: 0.001, // 0.1%
    max: 0.5, // 50%
    default: 0.05, // 5%
  },
  monitoringFrequency: {
    required: true,
    type: String,
    enum: ['10s', '1m', '5m', '15m', '1h', '4h', '1d'],
    default: '1h',
  },
  totalValueUSD: {
    type: Number,
    default: 0,
    min: 0,
  },
  lastRebalanceAt: {
    type: Date,
  },
  pkpInfo: {
    publicKey: {
      required: true,
      type: String,
    },
    tokenId: {
      required: true,
      type: String,
    },
  },
} as const;

const PortfolioSchema = new Schema(portfolioSchemaDefinition, { timestamps: true });

// Index pour les requêtes fréquentes
PortfolioSchema.index({ ethAddress: 1, isActive: 1 });
PortfolioSchema.index({ createdAt: -1 });

export const Portfolio = model('Portfolio', PortfolioSchema);
