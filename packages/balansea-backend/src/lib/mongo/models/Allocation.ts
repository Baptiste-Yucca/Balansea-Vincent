import { Schema, model, Types } from 'mongoose';

const allocationSchemaDefinition = {
  portfolioId: {
    required: true,
    type: Schema.Types.ObjectId,
    ref: 'Portfolio',
  },
  assetId: {
    required: true,
    type: Schema.Types.ObjectId,
    ref: 'Asset',
    index: true,
  },
  targetPercentage: {
    required: true,
    type: Number,
    min: 0,
    max: 1, // 0.5 = 50%
  },
  currentPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 1,
  },
  currentValueUSD: {
    type: Number,
    default: 0,
    min: 0,
  },
  currentBalance: {
    type: String, // Balance en wei/smallest unit
    default: '0',
  },
} as const;

const AllocationSchema = new Schema(allocationSchemaDefinition, { timestamps: true });

// Index composé pour les requêtes fréquentes
AllocationSchema.index({ portfolioId: 1, assetId: 1 }, { unique: true });
AllocationSchema.index({ portfolioId: 1 });

// Validation : la somme des targetPercentage doit être <= 1
AllocationSchema.pre('save', async function (next) {
  if (this.isNew || this.isModified('targetPercentage')) {
    const portfolioId = this.portfolioId;
    const currentAllocations = await Allocation.find({ portfolioId });
    const totalPercentage =
      currentAllocations
        .filter((allocation) => allocation._id.toString() !== this._id.toString())
        .reduce((sum, allocation) => sum + allocation.targetPercentage, 0) + this.targetPercentage;

    if (totalPercentage > 1) {
      return next(new Error('Total allocation percentage cannot exceed 100%'));
    }
  }
  next();
});

export const Allocation = model('Allocation', AllocationSchema);
