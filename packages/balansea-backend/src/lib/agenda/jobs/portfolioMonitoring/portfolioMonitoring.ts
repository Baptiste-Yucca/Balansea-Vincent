import * as Sentry from '@sentry/node';
import { Job } from '@whisthub/agenda';
import consola from 'consola';
import { Portfolio } from '../../../mongo/models';
import { calculateCurrentAllocations, updatePortfolioBalances } from './utils/balanceUtils';

export type JobType = Job<JobParams>;
export type JobParams = {
  portfolioId: string;
  ethAddress?: string;
  rebalanceType?: string;
  monitoringFrequency?: string;
};

export async function portfolioMonitoring(job: JobType, sentryScope: Sentry.Scope): Promise<void> {
  const { portfolioId } = job.attrs.data;
  consola.info(`${portfolioId} - monitoring started`);
  try {
    // 1. Check if portfolio exists and is active
    const portfolio = await Portfolio.findById(portfolioId);
    if (!portfolio || !portfolio.isActive) {
      consola.warn(
        `Portfolio ${portfolioId} not found or inactive (isActive: ${portfolio?.isActive})`
      );
      return;
    }
    // 2. Update balances from blockchain
    await updatePortfolioBalances(portfolioId);

    // 3. Calculate current allocations in USD
    const currentAllocations = await calculateCurrentAllocations(portfolioId);

    if (currentAllocations.length === 0) {
      consola.warn(`No allocations found for portfolio ${portfolioId}`);
      return;
    }

    // 4. Log current state
    const totalValueUSD = currentAllocations.reduce((sum, alloc) => sum + alloc.currentValueUSD, 0);
    consola.info(`Portfolio ${portfolioId} total value: $${totalValueUSD.toFixed(2)}`);

    for (const allocation of currentAllocations) {
      consola.info(
        `${allocation.asset.symbol}: ${(allocation.currentPercentage * 100).toFixed(2)}% (target: ${(allocation.targetPercentage * 100).toFixed(2)}%)`
      );
    }

    // 5. Determine if rebalancing is needed
    const needsRebalance = currentAllocations.some((alloc) => alloc.needsRebalance);

    if (needsRebalance) {
      consola.info(`${portfolioId} - needs rebalancing`);
      // TODO: Implement rebalancing logic in Phase 2.2
    } else {
      consola.info(`${portfolioId} - already balanced`);
    }

    consola.info(`${portfolioId} - Portfolio monitoring completed`);
  } catch (err) {
    sentryScope.captureException(err);
    const error = err as Error;

    // Handle fatal errors by disabling the job
    if (
      error?.message?.includes('Not enough balance') ||
      error?.message?.includes('insufficient funds') ||
      error?.message?.includes('gas too low') ||
      error?.message?.includes('out of gas')
    ) {
      consola.log(`Disabling portfolio job due to fatal error: ${error.message}`);
      job.disable();
      await job.save();
      throw new Error(`Portfolio monitoring disabled due to fatal error: ${error.message}`);
    }

    // Other errors just bubble up to the job doc
    throw err;
  } finally {
    Sentry.flush(2000);
  }
}
