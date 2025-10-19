import { Schema, model } from 'mongoose';

const assetSchemaDefinition = {
  symbol: {
    required: true,
    type: String,
    unique: true,
    uppercase: true,
  },
  name: {
    required: true,
    type: String,
  },
  address: {
    required: true,
    type: String,
    lowercase: true,
    match: /^0x[a-fA-F0-9]{40}$/,
  },
  decimals: {
    required: true,
    type: Number,
    min: 0,
    max: 18,
  },
  chainId: {
    required: true,
    type: Number,
    default: 8453, // Base mainnet
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  pythPriceId: {
    type: String,
    sparse: true, // Permet les valeurs null/undefined
  },
  logoUrl: {
    type: String,
    sparse: true,
  },
} as const;

const AssetSchema = new Schema(assetSchemaDefinition, { timestamps: true });

// Index pour les requêtes fréquentes
AssetSchema.index({ symbol: 1, isActive: 1 });
AssetSchema.index({ address: 1, chainId: 1 }, { unique: true });

export const Asset = model('Asset', AssetSchema);
