import consola from 'consola';
import { ethers } from 'ethers';
import { Portfolio, Allocation, Asset, PriceData } from '../../../../mongo/models';
import { env } from '../../../../env';

const { BASE_RPC_URL } = env;

// Provider for Base network
const baseProvider = new ethers.providers.StaticJsonRpcProvider(BASE_RPC_URL);

export interface CurrentBalance {
  symbol: string;
  balance: string; // Balance in smallest unit (wei, etc.)
  balanceFormatted: number; // Balance in token units
  usd: number; // Value in USD
  priceUSD: number; // Price per token in USD
}

export interface PortfolioAllocation {
  asset: {
    symbol: string;
    address: string;
    decimals: number;
  };
  targetPercentage: number;
  currentPercentage: number;
  currentValueUSD: number;
  currentBalance: string;
  gap: number; // Difference between current and target percentage
  needsRebalance: boolean;
}

/** Get current balances for all assets in a portfolio */
export async function getCurrentBalances(portfolioId: string): Promise<CurrentBalance[]> {
  try {
    consola.info(`Getting current balances for portfolio ${portfolioId}`);

    // Get portfolio
    const portfolio = await Portfolio.findById(portfolioId);
    if (!portfolio) {
      throw new Error(`Portfolio ${portfolioId} not found`);
    }

    const balances: CurrentBalance[] = [];

    // Get allocations separately
    const allocations = await Allocation.find({ portfolioId }).populate('assetId');

    // Get balances for each asset
    for (const allocation of allocations) {
      const asset = allocation.assetId as any; // Type assertion for populated field

      // Get token contract
      const tokenContract = new ethers.Contract(
        asset.address,
        ['function balanceOf(address) view returns (uint256)'],
        baseProvider
      );

      // Get balance from blockchain
      const balanceWei = await tokenContract.balanceOf(portfolio.ethAddress);
      const balanceFormatted = parseFloat(ethers.utils.formatUnits(balanceWei, asset.decimals));

      // Get latest price from database
      const latestPrice = await PriceData.findOne({
        assetId: asset._id,
      }).sort({ timestamp: -1 });

      if (!latestPrice) {
        consola.warn(`No price data found for ${asset.symbol}, skipping`);
        continue;
      }

      const usd = balanceFormatted * latestPrice.priceUSD;

      balances.push({
        symbol: asset.symbol,
        balance: balanceWei.toString(),
        balanceFormatted,
        usd,
        priceUSD: latestPrice.priceUSD,
      });

      consola.info(`${asset.symbol}: ${balanceFormatted.toFixed(6)} tokens = $${usd.toFixed(2)}`);
    }

    return balances;
  } catch (error) {
    consola.error(`Error getting current balances for portfolio ${portfolioId}:`, error);
    throw error;
  }
}

/** Calculate current portfolio allocations in USD */
export async function calculateCurrentAllocations(
  portfolioId: string
): Promise<PortfolioAllocation[]> {
  try {
    consola.info(`Calculating current allocations for portfolio ${portfolioId}`);

    // Get current balances
    const balances = await getCurrentBalances(portfolioId);
    const totalValueUSD = balances.reduce((sum, balance) => sum + balance.usd, 0);

    if (totalValueUSD === 0) {
      consola.warn(`Portfolio ${portfolioId} has zero value, cannot calculate allocations`);
      return [];
    }

    // Get portfolio
    const portfolio = await Portfolio.findById(portfolioId);
    if (!portfolio) {
      throw new Error(`Portfolio ${portfolioId} not found`);
    }

    // Get allocations separately
    const allocations = await Allocation.find({ portfolioId }).populate('assetId');

    const portfolioAllocations: PortfolioAllocation[] = [];

    for (const allocation of allocations) {
      const asset = allocation.assetId as any; // Type assertion for populated field
      const balance = balances.find((b) => b.symbol === asset.symbol);

      if (!balance) {
        consola.warn(`No balance found for ${asset.symbol}, using zero`);
        portfolioAllocations.push({
          asset: {
            symbol: asset.symbol,
            address: asset.address,
            decimals: asset.decimals,
          },
          targetPercentage: allocation.targetPercentage,
          currentPercentage: 0,
          currentValueUSD: 0,
          currentBalance: '0',
          gap: allocation.targetPercentage,
          needsRebalance: true,
        });
        continue;
      }

      const currentPercentage = balance.usd / totalValueUSD;
      const gap = currentPercentage - allocation.targetPercentage;
      const needsRebalance = Math.abs(gap) > 0.001; // 0.1% tolerance

      portfolioAllocations.push({
        asset: {
          symbol: asset.symbol,
          address: asset.address,
          decimals: asset.decimals,
        },
        targetPercentage: allocation.targetPercentage,
        currentPercentage,
        currentValueUSD: balance.usd,
        currentBalance: balance.balance,
        gap,
        needsRebalance,
      });

      consola.info(
        `${asset.symbol}: ${(currentPercentage * 100).toFixed(2)}% (target: ${(allocation.targetPercentage * 100).toFixed(2)}%, gap: ${(gap * 100).toFixed(2)}%)`
      );
    }

    return portfolioAllocations;
  } catch (error) {
    consola.error(`Error calculating current allocations for portfolio ${portfolioId}:`, error);
    throw error;
  }
}

/** Update portfolio balances in database */
export async function updatePortfolioBalances(portfolioId: string): Promise<void> {
  try {
    consola.info(`Updating portfolio balances for ${portfolioId}`);

    const allocations = await calculateCurrentAllocations(portfolioId);
    const totalValueUSD = allocations.reduce((sum, alloc) => sum + alloc.currentValueUSD, 0);

    // Update portfolio total value
    await Portfolio.findByIdAndUpdate(portfolioId, {
      totalValueUSD,
      lastRebalanceAt: new Date(),
    });

    // Update allocation records
    for (const allocation of allocations) {
      // Find the asset by symbol to get its ObjectId
      const asset = await Asset.findOne({ symbol: allocation.asset.symbol });
      if (!asset) {
        consola.warn(`Asset ${allocation.asset.symbol} not found, skipping update`);
        continue;
      }

      await Allocation.findOneAndUpdate(
        {
          portfolioId,
          assetId: asset._id,
        },
        {
          currentPercentage: allocation.currentPercentage,
          currentValueUSD: allocation.currentValueUSD,
          currentBalance: allocation.currentBalance,
        }
      );
    }

    consola.info(`Portfolio ${portfolioId} balances updated: $${totalValueUSD.toFixed(2)} total`);
  } catch (error) {
    consola.error(`Error updating portfolio balances for ${portfolioId}:`, error);
    throw error;
  }
}
