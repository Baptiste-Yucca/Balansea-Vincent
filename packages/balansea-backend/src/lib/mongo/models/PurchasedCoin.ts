import { Schema, model } from 'mongoose';

// This may seem like a very verbose file with excess local variables, but getting type inference to work with mongoose is extremely finicky.
const purchasedCoinSchemaDefinition = {
  coinAddress: {
    lowercase: true,
    match: /^0x[a-fA-F0-9]{40}$/,
    required: true,
    type: String,
  },
  ethAddress: {
    index: true,
    lowercase: true,
    match: /^0x[a-fA-F0-9]{40}$/,
    required: true,
    type: String,
  },
  purchaseAmount: {
    required: true,
    type: String,
    validate: {
      message: 'Purchase amount must be a valid decimal number',
      validator(v: string) {
        return /^\d*\.?\d+$/.test(v);
      },
    },
  },
  scheduleId: {
    index: true,
    required: true,
    type: Schema.Types.ObjectId,
  },
  symbol: {
    required: true,
    type: String,
  },
  txHash: {
    sparse: true,
    type: String,
    unique: true,
  },
} as const;

const PurchasedCoinSchema = new Schema(purchasedCoinSchemaDefinition, { timestamps: true });

// Create compound indices for common query patterns
PurchasedCoinSchema.index({ createdAt: 1, scheduleId: 1 });

export const PurchasedCoin = model('PurchasedCoin', PurchasedCoinSchema);
