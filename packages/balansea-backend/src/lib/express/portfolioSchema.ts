import { z } from 'zod';

// Schéma pour créer un portfolio
export const CreatePortfolioSchema = z.object({
  name: z.string().min(1).max(100),
  allocations: z
    .array(
      z.object({
        assetSymbol: z.string().min(1),
        targetPercentage: z.number().min(0).max(1),
      })
    )
    .min(1)
    .refine(
      (allocations) => {
        const total = allocations.reduce((sum, alloc) => sum + alloc.targetPercentage, 0);
        return Math.abs(total - 1) < 0.001; // Tolérance de 0.1%
      },
      { message: 'Total allocation percentage must equal 100%' }
    ),
  rebalanceThreshold: z.number().min(0.001).max(0.5).optional().default(0.05),
  monitoringFrequency: z
    .enum(['10s', '1m', '5m', '15m', '1h', '4h', '1d'])
    .optional()
    .default('1h'),
  rebalanceType: z.enum(['threshold', 'strict_periodic']).optional().default('threshold'),
});

// Schéma pour mettre à jour les allocations
export const UpdateAllocationsSchema = z.object({
  allocations: z
    .array(
      z.object({
        assetSymbol: z.string().min(1),
        targetPercentage: z.number().min(0).max(1),
      })
    )
    .min(1)
    .refine(
      (allocations) => {
        const total = allocations.reduce((sum, alloc) => sum + alloc.targetPercentage, 0);
        return Math.abs(total - 1) < 0.001;
      },
      { message: 'Total allocation percentage must equal 100%' }
    ),
});

// Schéma pour les paramètres de portfolio
export const PortfolioParamsSchema = z.object({
  portfolioId: z
    .string()
    .refine((val) => /^[0-9a-fA-F]{24}$/.test(val), { message: 'Invalid portfolio ID' }),
});

// Schéma pour les paramètres d'asset
export const AssetParamsSchema = z.object({
  assetSymbol: z.string().min(1).max(10),
});

// Schéma pour ajouter un nouvel asset
export const AddAssetSchema = z.object({
  symbol: z.string().min(1).max(10),
  name: z.string().min(1).max(100),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  decimals: z.number().min(0).max(18),
  chainId: z.number().optional().default(8453),
  pythPriceId: z.string().optional(),
  logoUrl: z.string().url().optional(),
});

// Types TypeScript dérivés
export type CreatePortfolioRequest = z.infer<typeof CreatePortfolioSchema>;
export type UpdateAllocationsRequest = z.infer<typeof UpdateAllocationsSchema>;
export type PortfolioParams = z.infer<typeof PortfolioParamsSchema>;
export type AssetParams = z.infer<typeof AssetParamsSchema>;
export type AddAssetRequest = z.infer<typeof AddAssetSchema>;
