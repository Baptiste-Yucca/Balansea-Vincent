import consola from 'consola';
import { ethers } from 'ethers';
import { PortfolioAllocation } from './balanceUtils';

export interface SwapOperation {
  tokenInSymbol: string;
  tokenOutSymbol: string;
  tokenInAddress: string;
  tokenOutAddress: string;
  tokenInDecimals: number;
  tokenOutDecimals: number;
  amountInUSD: number;
  amountInTokens: string; // Amount in smallest unit (wei, etc.)
  amountOutTokens: string; // Expected amount out in smallest unit
  gap: number; // Priority for ordering swaps
}

export interface RebalancePlan {
  swaps: SwapOperation[];
  totalValueUSD: number;
  isRebalanceNeeded: boolean;
}

/**
 * Calculate rebalancing swaps needed to achieve target allocations Algorithm: For each asset that
 * needs rebalancing, calculate the USD amount to buy/sell and convert to token amounts
 */
export function calculateRebalanceSwaps(
  allocations: PortfolioAllocation[],
  tolerance: number = 0.001 // 0.1% tolerance
): RebalancePlan {
  consola.info('Calculating rebalance swaps...');

  const totalValueUSD = allocations.reduce((sum, alloc) => sum + alloc.currentValueUSD, 0);

  if (totalValueUSD === 0) {
    consola.warn('Portfolio has zero value, no rebalancing needed');
    return {
      swaps: [],
      totalValueUSD: 0,
      isRebalanceNeeded: false,
    };
  }

  const swaps: SwapOperation[] = [];
  const assetsNeedingRebalance = allocations.filter((alloc) => alloc.needsRebalance);

  if (assetsNeedingRebalance.length === 0) {
    consola.info('Portfolio is already balanced within tolerance');
    return {
      swaps: [],
      totalValueUSD,
      isRebalanceNeeded: false,
    };
  }

  consola.info(`Found ${assetsNeedingRebalance.length} assets needing rebalancing`);

  // Calculate target values in USD for each asset
  const targetValuesUSD = allocations.map((alloc) => ({
    symbol: alloc.asset.symbol,
    targetValueUSD: totalValueUSD * alloc.targetPercentage,
    currentValueUSD: alloc.currentValueUSD,
    gap: alloc.gap,
    asset: alloc.asset,
  }));

  // Separate assets that need to be bought vs sold
  const assetsToBuy: typeof targetValuesUSD = [];
  const assetsToSell: typeof targetValuesUSD = [];

  for (const asset of targetValuesUSD) {
    const difference = asset.targetValueUSD - asset.currentValueUSD;
    if (difference > 0) {
      assetsToBuy.push({ ...asset, difference });
    } else if (difference < 0) {
      assetsToSell.push({ ...asset, difference: Math.abs(difference) });
    }
  }

  consola.info(`Assets to buy: ${assetsToBuy.length}, Assets to sell: ${assetsToSell.length}`);

  // Create swaps: for each asset that needs to be bought, create a swap from the asset that needs to be sold
  // Simple approach: if we have USDC to sell and need WBTC + WETH, create 2 separate swaps

  for (const buyAsset of assetsToBuy) {
    consola.info(`Need to buy ${buyAsset.symbol}: $${buyAsset.difference.toFixed(2)}`);

    // Find the asset with the largest amount to sell
    const sellAsset = assetsToSell.reduce((max, asset) =>
      asset.difference > max.difference ? asset : max
    );

    if (sellAsset.difference > 0.01) {
      // Calculate how much we can sell (limited by what we need to buy)
      const sellAmountUSD = Math.min(sellAsset.difference, buyAsset.difference);

      consola.info(
        `Creating swap: $${sellAmountUSD.toFixed(2)} ${sellAsset.symbol} -> ${buyAsset.symbol}`
      );

      // Get current prices from the allocations
      const sellAssetAllocation = allocations.find((a) => a.asset.symbol === sellAsset.symbol);
      const buyAssetAllocation = allocations.find((a) => a.asset.symbol === buyAsset.symbol);

      if (!sellAssetAllocation || !buyAssetAllocation) {
        consola.warn(`Could not find allocation for ${sellAsset.symbol} or ${buyAsset.symbol}`);
        continue;
      }

      // Use prices directly from Pyth (already calculated in balanceUtils)
      const sellAssetPriceUSD = sellAssetAllocation.currentPriceUSD;
      const buyAssetPriceUSD = buyAssetAllocation.currentPriceUSD;

      consola.info(
        `Prices from Pyth: ${sellAsset.symbol}=$${sellAssetPriceUSD.toFixed(2)}, ${buyAsset.symbol}=$${buyAssetPriceUSD.toFixed(2)}`
      );

      // Calculate token amounts for the swap
      const amountInTokens = ethers.utils.parseUnits(
        (sellAmountUSD / sellAssetPriceUSD).toFixed(sellAsset.asset.decimals),
        sellAsset.asset.decimals
      );

      const amountOutTokens = ethers.utils.parseUnits(
        (sellAmountUSD / buyAssetPriceUSD).toFixed(buyAsset.asset.decimals),
        buyAsset.asset.decimals
      );

      swaps.push({
        tokenInSymbol: sellAsset.symbol,
        tokenOutSymbol: buyAsset.symbol,
        tokenInAddress: sellAsset.asset.address,
        tokenOutAddress: buyAsset.asset.address,
        tokenInDecimals: sellAsset.asset.decimals,
        tokenOutDecimals: buyAsset.asset.decimals,
        amountInUSD: sellAmountUSD,
        amountInTokens: amountInTokens.toString(),
        amountOutTokens: amountOutTokens.toString(),
        gap: Math.abs(sellAsset.gap) + Math.abs(buyAsset.gap), // Priority based on total gap
      });

      consola.info(
        `Swap created: $${sellAmountUSD.toFixed(2)} ${sellAsset.symbol} -> ${buyAsset.symbol} (${sellAssetPriceUSD.toFixed(2)} -> ${buyAssetPriceUSD.toFixed(2)})`
      );

      // Update remaining amounts
      sellAsset.difference -= sellAmountUSD;
      buyAsset.difference -= sellAmountUSD;
    } else {
      consola.warn(`Not enough ${sellAsset.symbol} to sell for ${buyAsset.symbol}`);
    }
  }

  // Sort swaps by priority (largest gap first)
  swaps.sort((a, b) => b.gap - a.gap);

  consola.info(`Generated ${swaps.length} swaps for rebalancing`);

  return {
    swaps,
    totalValueUSD,
    isRebalanceNeeded: swaps.length > 0,
  };
}

/** Calculate token amounts from USD values using current prices */
export function calculateTokenAmounts(
  usdAmount: number,
  tokenPrice: number,
  decimals: number
): { amountTokens: string; amountFormatted: number } {
  const amountFormatted = usdAmount / tokenPrice;
  const amountTokens = ethers.utils
    .parseUnits(amountFormatted.toFixed(decimals), decimals)
    .toString();

  return {
    amountTokens,
    amountFormatted,
  };
}

/** Validate swap operation before execution */
export function validateSwapOperation(swap: SwapOperation): boolean {
  const minAmountUSD = 0.01; // Minimum $0.01 to avoid dust

  if (swap.amountInUSD < minAmountUSD) {
    consola.warn(`Swap amount too small: $${swap.amountInUSD.toFixed(4)}`);
    return false;
  }

  if (swap.tokenInAddress === swap.tokenOutAddress) {
    consola.warn('Cannot swap token to itself');
    return false;
  }

  return true;
}
