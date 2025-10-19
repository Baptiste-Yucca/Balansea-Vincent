import { Schema, model } from 'mongoose';

const swapOperationSchema = new Schema(
  {
    fromAsset: {
      type: String,
      required: true,
    },
    toAsset: {
      type: String,
      required: true,
    },
    amount: {
      type: String, // Montant en wei/smallest unit
      required: true,
    },
    expectedAmount: {
      type: String, // Montant attendu après swap
      required: true,
    },
    minAmountOut: {
      type: String, // Slippage protection
      required: true,
    },
    path: {
      type: [String], // Chemin de swap (ex: [USDC, WETH, WBTC])
      required: true,
    },
  },
  { _id: false }
);

const rebalanceJobSchemaDefinition = {
  portfolioId: {
    required: true,
    type: Schema.Types.ObjectId,
    ref: 'Portfolio',
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'executing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true,
  },
  rebalanceType: {
    type: String,
    enum: ['threshold', 'scheduled', 'manual'],
    required: true,
  },
  deviationDetected: {
    type: Number,
    required: true,
    min: 0,
  },
  swaps: [swapOperationSchema],
  txHashes: [
    {
      type: String,
      match: /^0x[a-fA-F0-9]{64}$/,
    },
  ],
  errorMessage: {
    type: String,
  },
  gasUsed: {
    type: String,
  },
  gasPrice: {
    type: String,
  },
  executedAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
} as const;

const RebalanceJobSchema = new Schema(rebalanceJobSchemaDefinition, { timestamps: true });

// Index pour les requêtes fréquentes
RebalanceJobSchema.index({ portfolioId: 1, status: 1 });
RebalanceJobSchema.index({ createdAt: -1 });
RebalanceJobSchema.index({ status: 1, createdAt: 1 });

export const RebalanceJob = model('RebalanceJob', RebalanceJobSchema);
