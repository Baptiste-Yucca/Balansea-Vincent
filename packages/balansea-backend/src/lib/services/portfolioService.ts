import consola from 'consola';
import { Portfolio, Allocation, Asset } from '../mongo/models';
import { createPortfolioJob } from '../agenda/jobs/portfolioJobManager';

const logger = consola.withTag('PortfolioService');

export class PortfolioService {
  /** Crée un nouveau portfolio avec des allocations */
  static async createPortfolio(data: {
    ethAddress: string;
    name: string;
    pkpInfo: {
      publicKey: string;
      tokenId: string;
    };
    allocations: Array<{
      assetSymbol: string;
      targetPercentage: number;
    }>;
    rebalanceThreshold?: number;
    monitoringFrequency?: string;
    rebalanceType?: string;
  }): Promise<any> {
    try {
      // Vérifier que la somme des allocations = 100%
      const totalPercentage = data.allocations.reduce(
        (sum, alloc) => sum + alloc.targetPercentage,
        0
      );
      if (Math.abs(totalPercentage - 1) > 0.001) {
        // Tolérance de 0.1%
        throw new Error('Total allocation percentage must equal 100%');
      }

      // Créer le portfolio
      const portfolio = new Portfolio({
        ethAddress: data.ethAddress.toLowerCase(),
        name: data.name,
        pkpInfo: data.pkpInfo,
        rebalanceThreshold: data.rebalanceThreshold || 0.05, // 5% par défaut
        monitoringFrequency: data.monitoringFrequency || '1h',
        rebalanceType: data.rebalanceType || 'threshold',
        totalValueUSD: 0,
      });

      await portfolio.save();

      // Créer les allocations
      for (const allocationData of data.allocations) {
        const asset = await Asset.findOne({
          symbol: allocationData.assetSymbol.toUpperCase(),
          isActive: true,
        });

        if (!asset) {
          throw new Error(`Asset ${allocationData.assetSymbol} not found or inactive`);
        }

        const allocation = new Allocation({
          portfolioId: portfolio._id,
          assetId: asset._id,
          targetPercentage: allocationData.targetPercentage,
          currentPercentage: 0,
          currentValueUSD: 0,
          currentBalance: '0',
        });

        await allocation.save();
      }

      logger.log(`Created portfolio: ${data.name} for ${data.ethAddress}`);

      // Schedule portfolio monitoring job (like DCA jobs)
      try {
        await createPortfolioJob(
          {
            portfolioId: portfolio._id.toString(),
            ethAddress: data.ethAddress,
            rebalanceType: data.rebalanceType || 'threshold',
            monitoringFrequency: data.monitoringFrequency || '1h',
          },
          { interval: data.monitoringFrequency || '1h' }
        );
        logger.log(`Scheduled portfolio monitoring job for portfolio ${portfolio._id}`);
      } catch (error) {
        logger.error('Failed to schedule portfolio monitoring job:', error);
        // Don't fail portfolio creation if job scheduling fails
      }

      return await this.getPortfolioWithAllocations(portfolio._id.toString());
    } catch (error) {
      logger.error('Error creating portfolio:', error);
      throw error;
    }
  }

  /** Récupère un portfolio avec ses allocations et assets */
  static async getPortfolioWithAllocations(portfolioId: string): Promise<any> {
    try {
      const portfolio = await Portfolio.findById(portfolioId);
      if (!portfolio) {
        throw new Error('Portfolio not found');
      }

      const allocations = await Allocation.find({ portfolioId })
        .populate('assetId')
        .sort({ targetPercentage: -1 });

      return {
        ...portfolio.toObject(),
        allocations: allocations.map((alloc) => ({
          ...alloc.toObject(),
          asset: alloc.assetId,
        })),
      };
    } catch (error) {
      logger.error('Error fetching portfolio with allocations:', error);
      throw error;
    }
  }

  /** Récupère tous les portfolios d'un utilisateur */
  static async getUserPortfolios(ethAddress: string): Promise<any[]> {
    try {
      const portfolios = await Portfolio.find({
        ethAddress: ethAddress.toLowerCase(),
        isActive: true,
      }).sort({ createdAt: -1 });

      const portfoliosWithAllocations = await Promise.all(
        portfolios.map((portfolio) => this.getPortfolioWithAllocations(portfolio._id.toString()))
      );

      return portfoliosWithAllocations;
    } catch (error) {
      logger.error('Error fetching user portfolios:', error);
      throw error;
    }
  }

  /** Met à jour les allocations d'un portfolio */
  static async updatePortfolioAllocations(
    portfolioId: string,
    allocations: Array<{
      assetSymbol: string;
      targetPercentage: number;
    }>
  ): Promise<any> {
    try {
      // Vérifier que la somme des allocations = 100%
      const totalPercentage = allocations.reduce((sum, alloc) => sum + alloc.targetPercentage, 0);
      if (Math.abs(totalPercentage - 1) > 0.001) {
        throw new Error('Total allocation percentage must equal 100%');
      }

      // Supprimer les anciennes allocations
      await Allocation.deleteMany({ portfolioId });

      // Créer les nouvelles allocations
      for (const allocationData of allocations) {
        const asset = await Asset.findOne({
          symbol: allocationData.assetSymbol.toUpperCase(),
          isActive: true,
        });

        if (!asset) {
          throw new Error(`Asset ${allocationData.assetSymbol} not found or inactive`);
        }

        const allocation = new Allocation({
          portfolioId,
          assetId: asset._id,
          targetPercentage: allocationData.targetPercentage,
          currentPercentage: 0,
          currentValueUSD: 0,
          currentBalance: '0',
        });

        await allocation.save();
      }

      logger.log(`Updated allocations for portfolio: ${portfolioId}`);
      return await this.getPortfolioWithAllocations(portfolioId);
    } catch (error) {
      logger.error('Error updating portfolio allocations:', error);
      throw error;
    }
  }

  /** Désactive un portfolio */
  static async deactivatePortfolio(portfolioId: string): Promise<void> {
    try {
      const portfolio = await Portfolio.findById(portfolioId);
      if (!portfolio) {
        throw new Error('Portfolio not found');
      }

      portfolio.isActive = false;
      await portfolio.save();

      logger.log(`Deactivated portfolio: ${portfolioId}`);
    } catch (error) {
      logger.error('Error deactivating portfolio:', error);
      throw error;
    }
  }

  /** Met à jour la valeur totale du portfolio */
  static async updatePortfolioValue(portfolioId: string, totalValueUSD: number): Promise<void> {
    try {
      await Portfolio.findByIdAndUpdate(portfolioId, { totalValueUSD });
    } catch (error) {
      logger.error('Error updating portfolio value:', error);
      throw error;
    }
  }
}
