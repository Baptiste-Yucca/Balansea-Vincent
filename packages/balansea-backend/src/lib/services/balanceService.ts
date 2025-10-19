import { ethers } from 'ethers';
import consola from 'consola';
import { Allocation, Asset } from '../mongo/models';
import { DynamicSwapService } from '../vincent/dynamicSwapService';
import { PythService } from './pythService';

export interface BalanceInfo {
  assetSymbol: string;
  balance: string; // En wei/smallest unit
  balanceFormatted: number; // En unités normales
  priceUSD: number;
  valueUSD: number;
}

export interface PortfolioBalance {
  portfolioId: string;
  totalValueUSD: number;
  balances: BalanceInfo[];
}

export class BalanceService {
  private static readonly BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org/';
  private static provider = new ethers.providers.StaticJsonRpcProvider(this.BASE_RPC_URL);

  /** Mettre à jour les balances d'un portfolio depuis la blockchain */
  static async updatePortfolioBalances(
    portfolioId: string,
    ethAddress: string
  ): Promise<PortfolioBalance> {
    try {
      consola.info(`Mise à jour des balances pour le portfolio ${portfolioId}`);

      // 1. Récupérer les allocations du portfolio
      const allocations = await Allocation.find({ portfolioId }).populate('assetId').lean();

      if (!allocations.length) {
        throw new Error('Aucune allocation trouvée pour ce portfolio');
      }

      // 2. Récupérer les balances depuis la blockchain
      const balanceInfos: BalanceInfo[] = [];
      let totalValueUSD = 0;

      for (const allocation of allocations) {
        const asset = allocation.assetId as any;

        // Récupérer la balance depuis la blockchain
        const balance = await this.getTokenBalance(ethAddress, asset.address, asset.decimals);

        // Récupérer le prix depuis Pyth
        const priceUSD = await this.getAssetPrice(asset.symbol);

        // Calculer la valeur USD
        const valueUSD = balance.balanceFormatted * priceUSD;
        totalValueUSD += valueUSD;

        balanceInfos.push({
          assetSymbol: asset.symbol,
          balance: balance.balance,
          balanceFormatted: balance.balanceFormatted,
          priceUSD,
          valueUSD,
        });

        // Mettre à jour l'allocation en base
        await Allocation.findByIdAndUpdate(allocation._id, {
          currentBalance: balance.balance,
          currentValueUSD: valueUSD,
          currentPercentage: 0, // Sera calculé après
        });
      }

      // 3. Calculer et mettre à jour les pourcentages
      for (const allocation of allocations) {
        const balanceInfo = balanceInfos.find((b) => b.assetSymbol === allocation.assetId.symbol);
        if (balanceInfo && totalValueUSD > 0) {
          const currentPercentage = balanceInfo.valueUSD / totalValueUSD;
          await Allocation.findByIdAndUpdate(allocation._id, {
            currentPercentage,
          });
        }
      }

      // 4. Mettre à jour la valeur totale du portfolio
      await this.updatePortfolioTotalValue(portfolioId, totalValueUSD);

      consola.info(`Balances mises à jour: ${totalValueUSD.toFixed(2)} USD`);

      return {
        portfolioId,
        totalValueUSD,
        balances: balanceInfos,
      };
    } catch (error) {
      consola.error('Erreur mise à jour balances:', error);
      throw error;
    }
  }

  /** Récupérer la balance d'un token pour une adresse */
  private static async getTokenBalance(
    ethAddress: string,
    tokenAddress: string,
    decimals: number
  ): Promise<{ balance: string; balanceFormatted: number }> {
    try {
      // Si c'est ETH (adresse 0x0), utiliser getBalance
      if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        const balance = await this.provider.getBalance(ethAddress);
        return {
          balance: balance.toString(),
          balanceFormatted: parseFloat(ethers.utils.formatEther(balance)),
        };
      }

      // Pour les tokens ERC20, utiliser le contrat
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address) view returns (uint256)'],
        this.provider
      );

      const balance = await tokenContract.balanceOf(ethAddress);
      const balanceFormatted = parseFloat(ethers.utils.formatUnits(balance, decimals));

      return {
        balance: balance.toString(),
        balanceFormatted,
      };
    } catch (error) {
      consola.error(`Erreur récupération balance ${tokenAddress}:`, error);
      return {
        balance: '0',
        balanceFormatted: 0,
      };
    }
  }

  /** Récupérer le prix d'un asset depuis Pyth */
  private static async getAssetPrice(symbol: string): Promise<number> {
    try {
      const price = await PythService.getPrice(symbol as any);
      return price?.price || 0;
    } catch (error) {
      consola.error(`Erreur récupération prix ${symbol}:`, error);
      return 0;
    }
  }

  /** Mettre à jour la valeur totale du portfolio */
  private static async updatePortfolioTotalValue(
    portfolioId: string,
    totalValueUSD: number
  ): Promise<void> {
    try {
      const { Portfolio } = await import('../mongo/models');
      await Portfolio.findByIdAndUpdate(portfolioId, {
        totalValueUSD,
      });
    } catch (error) {
      consola.error('Erreur mise à jour valeur totale portfolio:', error);
    }
  }

  /** Initialiser les balances lors du premier dépôt */
  static async initializePortfolioBalances(
    portfolioId: string,
    ethAddress: string,
    initialDeposit: { assetSymbol: string; amount: number }[]
  ): Promise<void> {
    try {
      consola.info(`Initialisation des balances pour le portfolio ${portfolioId}`);

      // 1. Mettre à jour les balances depuis la blockchain
      const portfolioBalance = await this.updatePortfolioBalances(portfolioId, ethAddress);

      // 2. Vérifier que les montants correspondent aux dépôts initiaux
      for (const deposit of initialDeposit) {
        const balanceInfo = portfolioBalance.balances.find(
          (b) => b.assetSymbol === deposit.assetSymbol
        );
        if (!balanceInfo || balanceInfo.balanceFormatted < deposit.amount) {
          throw new Error(
            `Balance insuffisante pour ${deposit.assetSymbol}: ${balanceInfo?.balanceFormatted || 0} < ${deposit.amount}`
          );
        }
      }

      // 3. Effectuer le rééquilibrage initial si nécessaire
      const needsInitialRebalance = await this.checkInitialRebalanceNeeded(portfolioId);
      if (needsInitialRebalance) {
        await this.performInitialRebalance(portfolioId, ethAddress);
      }

      consola.info(`Initialisation terminée pour le portfolio ${portfolioId}`);
    } catch (error) {
      consola.error('Erreur initialisation balances:', error);
      throw error;
    }
  }

  /** Vérifier si un rééquilibrage initial est nécessaire */
  private static async checkInitialRebalanceNeeded(portfolioId: string): Promise<boolean> {
    try {
      const allocations = await Allocation.find({ portfolioId });

      for (const allocation of allocations) {
        const deviation = Math.abs(allocation.currentPercentage - allocation.targetPercentage);
        if (deviation > 0.01) {
          // Seuil de 1%
          return true;
        }
      }

      return false;
    } catch (error) {
      consola.error('Erreur vérification rééquilibrage initial:', error);
      return false;
    }
  }

  /** Effectuer le rééquilibrage initial */
  private static async performInitialRebalance(
    portfolioId: string,
    ethAddress: string
  ): Promise<void> {
    try {
      consola.info(`Rééquilibrage initial pour le portfolio ${portfolioId}`);

      // Utiliser le service de rééquilibrage existant
      const { RebalanceService } = await import('./rebalanceService');
      const rebalancePlan = await RebalanceService.createRebalancePlan(portfolioId);

      if (rebalancePlan.needsRebalance && rebalancePlan.swaps.length > 0) {
        // Exécuter les swaps de rééquilibrage
        const dynamicSwaps = rebalancePlan.swaps.map((swap) => ({
          fromAsset: swap.fromAsset,
          toAsset: swap.toAsset,
          amount: swap.amount,
          recipient: ethAddress,
        }));

        await DynamicSwapService.executeRebalanceSwaps(dynamicSwaps);

        // Mettre à jour les balances après le rééquilibrage
        await this.updatePortfolioBalances(portfolioId, ethAddress);
      }
    } catch (error) {
      consola.error('Erreur rééquilibrage initial:', error);
      throw error;
    }
  }

  /** Obtenir les balances actuelles d'un portfolio */
  static async getPortfolioBalances(portfolioId: string): Promise<PortfolioBalance> {
    try {
      const allocations = await Allocation.find({ portfolioId }).populate('assetId').lean();

      const balances: BalanceInfo[] = allocations.map((allocation) => ({
        assetSymbol: allocation.assetId.symbol,
        balance: allocation.currentBalance,
        balanceFormatted:
          parseFloat(allocation.currentBalance) / Math.pow(10, allocation.assetId.decimals),
        priceUSD:
          allocation.currentValueUSD /
            (parseFloat(allocation.currentBalance) / Math.pow(10, allocation.assetId.decimals)) ||
          0,
        valueUSD: allocation.currentValueUSD,
      }));

      const totalValueUSD = balances.reduce((sum, b) => sum + b.valueUSD, 0);

      return {
        portfolioId,
        totalValueUSD,
        balances,
      };
    } catch (error) {
      consola.error('Erreur récupération balances:', error);
      throw error;
    }
  }
}
