import { Types } from 'mongoose';
import consola from 'consola';
import { Portfolio, Allocation, PriceData } from '../mongo/models';
import { PythService } from './pythService';
import { DynamicSwapService } from '../vincent/dynamicSwapService';
import { BalanceService } from './balanceService';

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
      const portfolio = await Portfolio.findById(portfolioId);
      if (!portfolio) {
        throw new Error('Portfolio non trouvé');
      }

      // Utiliser le service de balances pour obtenir les données à jour
      const portfolioBalance = await BalanceService.getPortfolioBalances(portfolioId);

      const allocations = await Allocation.find({ portfolioId }).populate('assetId').lean();

      const deviations: DeviationResult[] = [];

      for (const allocation of allocations) {
        const asset = allocation.assetId as any;

        // Trouver la balance correspondante
        const balanceInfo = portfolioBalance.balances.find((b) => b.assetSymbol === asset.symbol);
        if (!balanceInfo) {
          consola.warn(`Balance non trouvée pour ${asset.symbol}`);
          continue;
        }

        const currentPercentage =
          portfolioBalance.totalValueUSD > 0
            ? balanceInfo.valueUSD / portfolioBalance.totalValueUSD
            : 0;

        const deviation = Math.abs(currentPercentage - allocation.targetPercentage);
        const needsRebalance = deviation > (portfolio.rebalanceThreshold || 0.05); // Seuil par défaut 5%

        deviations.push({
          assetSymbol: asset.symbol,
          targetPercentage: allocation.targetPercentage,
          currentPercentage,
          deviation,
          needsRebalance,
          currentValueUSD: balanceInfo.valueUSD,
          targetValueUSD: portfolioBalance.totalValueUSD * allocation.targetPercentage,
        });
      }

      return deviations;
    } catch (error) {
      consola.error('Erreur calcul déviations:', error);
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
            // Convertir le montant USD en montant de token
            const currentPrice =
              excess.currentValueUSD / (parseFloat(excess.assetSymbol === 'WBTC' ? '1' : '1') || 1); // Simplifié
            const tokenAmount = amountToSell / currentPrice;

            swaps.push({
              fromAsset: excess.assetSymbol,
              toAsset: deficit.assetSymbol,
              amount: tokenAmount,
              expectedAmount: amountToSell, // Montant USD attendu
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
