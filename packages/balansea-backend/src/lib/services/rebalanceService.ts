import { Types } from 'mongoose';
import { Portfolio, Allocation, PriceData } from '../mongo/models';
import { PythService } from './pythService';
import { serviceLogger } from '../logger';

export interface DeviationResult {
  assetSymbol: string;
  targetPercentage: number;
  currentPercentage: number;
  deviation: number;
  needsRebalance: boolean;
  currentValueUSD: number;
  targetValueUSD: number;
}

export interface RebalancePlan {
  portfolioId: string;
  totalValueUSD: number;
  deviations: DeviationResult[];
  needsRebalance: boolean;
  swaps: SwapOperation[];
}

export interface SwapOperation {
  fromAsset: string;
  toAsset: string;
  amount: number;
  expectedAmount: number;
  reason: string;
}

export class RebalanceService {
  /** Calculer les déviations d'un portfolio */
  static async calculateDeviations(portfolioId: string): Promise<DeviationResult[]> {
    try {
      const portfolio = await Portfolio.findById(portfolioId).populate({
        path: 'allocations',
        populate: {
          path: 'assetId',
          model: 'Asset',
        },
      });

      if (!portfolio) {
        throw new Error('Portfolio non trouvé');
      }

      // 1. Récupérer les prix actuels
      const currentPrices = await this.getCurrentPrices(portfolio.allocations);

      // 2. Calculer la valeur totale du portfolio
      const totalValueUSD = await this.calculateTotalValue(portfolio.allocations, currentPrices);

      // 3. Calculer les pourcentages actuels et déviations
      const deviations: DeviationResult[] = [];

      for (const allocation of portfolio.allocations) {
        const asset = allocation.assetId;
        const currentPrice = currentPrices.get(asset.symbol) || 0;
        const currentValueUSD = allocation.currentBalance
          ? parseFloat(allocation.currentBalance) * currentPrice
          : 0;

        const currentPercentage = totalValueUSD > 0 ? currentValueUSD / totalValueUSD : 0;
        const targetPercentage = allocation.targetPercentage;
        const deviation = Math.abs(currentPercentage - targetPercentage);

        deviations.push({
          assetSymbol: asset.symbol,
          targetPercentage,
          currentPercentage,
          deviation,
          needsRebalance: deviation > portfolio.rebalanceThreshold,
          currentValueUSD,
          targetValueUSD: totalValueUSD * targetPercentage,
        });
      }

      return deviations;
    } catch (error) {
      serviceLogger.error('Erreur calcul déviations:', error);
      throw error;
    }
  }

  /** Déterminer si un portfolio a besoin d'être rééquilibré */
  static async needsRebalancing(portfolioId: string): Promise<boolean> {
    const deviations = await this.calculateDeviations(portfolioId);
    return deviations.some((d) => d.needsRebalance);
  }

  /** Créer un plan de rééquilibrage */
  static async createRebalancePlan(portfolioId: string): Promise<RebalancePlan> {
    const deviations = await this.calculateDeviations(portfolioId);
    const portfolio = await Portfolio.findById(portfolioId);

    if (!portfolio) {
      throw new Error('Portfolio non trouvé');
    }

    const totalValueUSD = deviations.reduce((sum, d) => sum + d.currentValueUSD, 0);
    const needsRebalance = deviations.some((d) => d.needsRebalance);

    // Créer les opérations de swap nécessaires
    const swaps = await this.generateSwapOperations(deviations, totalValueUSD);

    return {
      portfolioId,
      totalValueUSD,
      deviations,
      needsRebalance,
      swaps,
    };
  }

  /** Récupérer les prix actuels pour les assets */
  private static async getCurrentPrices(allocations: any[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    for (const allocation of allocations) {
      const asset = allocation.assetId;

      // Essayer d'abord la base de données (prix récent)
      const recentPrice = await PriceData.findOne({
        assetId: asset._id,
      }).sort({ timestamp: -1 });

      if (recentPrice && this.isPriceRecent(recentPrice.timestamp)) {
        prices.set(asset.symbol, recentPrice.priceUSD);
      } else {
        // Sinon, récupérer depuis Pyth
        const pythPrice = await PythService.getPrice(asset.symbol as any);
        if (pythPrice) {
          prices.set(asset.symbol, pythPrice.price);
        }
      }
    }

    return prices;
  }

  /** Calculer la valeur totale du portfolio */
  private static async calculateTotalValue(
    allocations: any[],
    prices: Map<string, number>
  ): Promise<number> {
    let totalValue = 0;

    for (const allocation of allocations) {
      const asset = allocation.assetId;
      const price = prices.get(asset.symbol) || 0;
      const balance = allocation.currentBalance ? parseFloat(allocation.currentBalance) : 0;
      totalValue += balance * price;
    }

    return totalValue;
  }

  /** Générer les opérations de swap nécessaires */
  private static async generateSwapOperations(
    deviations: DeviationResult[],
    totalValueUSD: number
  ): Promise<SwapOperation[]> {
    const swaps: SwapOperation[] = [];

    // Trier par déviation (plus grande d'abord)
    const sortedDeviations = deviations
      .filter((d) => d.needsRebalance)
      .sort((a, b) => b.deviation - a.deviation);

    // Logique simple : vendre les assets en excès, acheter ceux en déficit
    const excessAssets = sortedDeviations.filter((d) => d.currentPercentage > d.targetPercentage);
    const deficitAssets = sortedDeviations.filter((d) => d.currentPercentage < d.targetPercentage);

    for (const excess of excessAssets) {
      for (const deficit of deficitAssets) {
        if (excess.needsRebalance && deficit.needsRebalance) {
          const amountToSell = (excess.currentValueUSD - excess.targetValueUSD) / 2; // Diviser par 2 pour éviter les overshoots

          if (amountToSell > 0) {
            swaps.push({
              fromAsset: excess.assetSymbol,
              toAsset: deficit.assetSymbol,
              amount: amountToSell,
              expectedAmount: amountToSell, // Sera calculé avec le prix de marché
              reason: `Rééquilibrage: ${excess.assetSymbol} -> ${deficit.assetSymbol}`,
            });
          }
        }
      }
    }

    return swaps;
  }

  /** Vérifier si un prix est récent (moins de 5 minutes) */
  private static isPriceRecent(timestamp: Date): boolean {
    const now = new Date();
    const diffMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60);
    return diffMinutes < 5;
  }
}
