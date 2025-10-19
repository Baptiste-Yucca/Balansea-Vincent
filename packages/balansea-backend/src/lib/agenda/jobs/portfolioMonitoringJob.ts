import { Job } from 'agenda';
import { Portfolio } from '../../mongo/models';
import { RebalanceService } from '../../services/rebalanceService';
import { CowSwapAbility } from '../vincent/cowSwapAbility';
import { serviceLogger } from '../../logger';

export interface PortfolioMonitoringJobData {
  portfolioId: string;
}

export class PortfolioMonitoringJob {
  /** Job principal de surveillance des portfolios */
  static async execute(job: Job<PortfolioMonitoringJobData>): Promise<void> {
    const { portfolioId } = job.attrs.data;

    try {
      serviceLogger.info(`Surveillance portfolio ${portfolioId}`);

      // 1. Vérifier si le portfolio a besoin d'être rééquilibré
      const needsRebalancing = await RebalanceService.needsRebalancing(portfolioId);

      if (!needsRebalancing) {
        serviceLogger.info(`Portfolio ${portfolioId} - Aucun rééquilibrage nécessaire`);
        return;
      }

      // 2. Créer le plan de rééquilibrage
      const rebalancePlan = await RebalanceService.createRebalancePlan(portfolioId);

      serviceLogger.info(`Portfolio ${portfolioId} - Rééquilibrage nécessaire:`, {
        totalValue: rebalancePlan.totalValueUSD,
        swaps: rebalancePlan.swaps.length,
      });

      // 3. Exécuter les swaps via Cow.finance
      if (rebalancePlan.swaps.length > 0) {
        await this.executeRebalancing(portfolioId, rebalancePlan);
      }
    } catch (error) {
      serviceLogger.error(`Erreur surveillance portfolio ${portfolioId}:`, error);
      throw error;
    }
  }

  /** Exécuter le rééquilibrage */
  private static async executeRebalancing(portfolioId: string, plan: any): Promise<void> {
    try {
      serviceLogger.info(`Exécution rééquilibrage portfolio ${portfolioId}`);

      // 1. Créer les ordres Cow.finance
      const swapResults = await CowSwapAbility.executeRebalanceSwaps(plan.swaps);

      // 2. Enregistrer les résultats en base
      await this.recordRebalanceJob(portfolioId, plan, swapResults);

      // 3. Mettre à jour le portfolio
      await this.updatePortfolioAfterRebalance(portfolioId, plan);

      serviceLogger.info(`Rééquilibrage portfolio ${portfolioId} terminé`);
    } catch (error) {
      serviceLogger.error(`Erreur exécution rééquilibrage ${portfolioId}:`, error);
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
      serviceLogger.error('Erreur enregistrement job rééquilibrage:', error);
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
      serviceLogger.error('Erreur mise à jour portfolio:', error);
    }
  }
}
