import { Job } from 'agenda';
import consola from 'consola';
import { Portfolio } from '../../mongo/models';
import { RebalanceService } from '../../services/rebalanceService';
import { DynamicSwapService } from '../vincent/dynamicSwapService';
import { BalanceService } from '../../services/balanceService';

export interface PortfolioMonitoringJobData {
  portfolioId: string;
}

export class PortfolioMonitoringJob {
  /** Job principal de surveillance des portfolios */
  static async execute(job: Job<PortfolioMonitoringJobData>): Promise<void> {
    const { portfolioId } = job.attrs.data;

    try {
      consola.info(`Surveillance portfolio ${portfolioId}`);

      // 1. Vérifier si le portfolio existe et est actif
      const portfolio = await Portfolio.findById(portfolioId);
      if (!portfolio || !portfolio.isActive) {
        consola.warn(`Portfolio ${portfolioId} non trouvé ou inactif`);
        return;
      }

      // 2. Mettre à jour les balances depuis la blockchain
      await BalanceService.updatePortfolioBalances(portfolioId, portfolio.ethAddress);

      // 3. Calculer les déviations avec les balances à jour
      const deviations = await RebalanceService.calculateDeviations(portfolioId);

      // 4. Vérifier si un rééquilibrage est nécessaire
      const needsRebalance = deviations.some((d) => d.needsRebalance);

      if (needsRebalance) {
        consola.info(`Rééquilibrage nécessaire pour le portfolio ${portfolioId}`);

        // 5. Créer le plan de rééquilibrage
        const rebalancePlan = await RebalanceService.createRebalancePlan(portfolioId);

        if (rebalancePlan.needsRebalance) {
          // 6. Exécuter le rééquilibrage
          await this.executeRebalancing(portfolioId, rebalancePlan);

          // 7. Mettre à jour les balances après le rééquilibrage
          await BalanceService.updatePortfolioBalances(portfolioId, portfolio.ethAddress);
        }
      } else {
        consola.info(`Portfolio ${portfolioId} équilibré`);
      }
    } catch (error) {
      consola.error(`Erreur surveillance portfolio ${portfolioId}:`, error);
      throw error;
    }
  }

  /** Exécuter le rééquilibrage */
  private static async executeRebalancing(portfolioId: string, plan: any): Promise<void> {
    try {
      consola.info(`Exécution rééquilibrage portfolio ${portfolioId}`);

      // 1. Convertir les swaps pour le service dynamique
      const dynamicSwaps = plan.swaps.map((swap: any) => ({
        fromAsset: swap.fromAsset,
        toAsset: swap.toAsset,
        amount: swap.amount,
        recipient: plan.portfolioId, // À adapter selon votre logique
      }));

      // 2. Exécuter les swaps via Uniswap
      const swapResults = await DynamicSwapService.executeRebalanceSwaps(dynamicSwaps);

      // 3. Enregistrer les résultats en base
      await this.recordRebalanceJob(portfolioId, plan, swapResults);

      // 4. Mettre à jour le portfolio
      await this.updatePortfolioAfterRebalance(portfolioId, plan);

      consola.info(`Rééquilibrage portfolio ${portfolioId} terminé`);
    } catch (error) {
      consola.error(`Erreur exécution rééquilibrage ${portfolioId}:`, error);
      throw error;
    }
  }

  /** Enregistrer le job de rééquilibrage */
  private static async recordRebalanceJob(
    portfolioId: string,
    plan: any,
    swapResults: any[]
  ): Promise<void> {
    try {
      const { RebalanceJob } = await import('../../mongo/models');

      const rebalanceJob = new RebalanceJob({
        portfolioId: new (await import('mongoose')).Types.ObjectId(portfolioId),
        status: 'executing',
        rebalanceType: 'threshold',
        deviationDetected: Math.max(...plan.deviations.map((d: any) => d.deviation)),
        swaps: plan.swaps.map((swap: any, index: number) => ({
          fromAsset: swap.fromAsset,
          toAsset: swap.toAsset,
          amount: swap.amount,
          expectedAmount: swap.expectedAmount,
        })),
        txHashes: swapResults.map((r) => r.txHash || ''),
        executedAt: new Date(),
      });

      await rebalanceJob.save();
    } catch (error) {
      consola.error('Erreur enregistrement job rééquilibrage:', error);
    }
  }

  /** Mettre à jour le portfolio après rééquilibrage */
  private static async updatePortfolioAfterRebalance(
    portfolioId: string,
    plan: any
  ): Promise<void> {
    try {
      await Portfolio.findByIdAndUpdate(portfolioId, {
        $set: {
          lastRebalanceAt: new Date(),
          totalValueUSD: plan.totalValueUSD,
        },
      });

      // Mettre à jour les allocations avec les nouveaux pourcentages
      for (const deviation of plan.deviations) {
        await Portfolio.updateOne(
          {
            _id: portfolioId,
            'allocations.assetId': deviation.assetSymbol,
          },
          {
            $set: {
              'allocations.$.currentPercentage': deviation.targetPercentage,
              'allocations.$.currentValueUSD': deviation.targetValueUSD,
            },
          }
        );
      }
    } catch (error) {
      consola.error('Erreur mise à jour portfolio:', error);
    }
  }
}
