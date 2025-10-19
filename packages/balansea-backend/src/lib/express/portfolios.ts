import { Response } from 'express';

import { getAppInfo, getPKPInfo, isAppUser } from '@lit-protocol/vincent-app-sdk/jwt';

import { PortfolioService } from '../services';
import { VincentAuthenticatedRequest } from './types';
import {
  CreatePortfolioSchema,
  UpdateAllocationsSchema,
  PortfolioParamsSchema,
} from './portfolioSchema';

function getDataFromJWT(req: VincentAuthenticatedRequest) {
  if (!isAppUser(req.user.decodedJWT)) {
    throw new Error('Vincent JWT is not an app user');
  }

  const app = getAppInfo(req.user.decodedJWT);
  const pkpInfo = getPKPInfo(req.user.decodedJWT);

  return { app, pkpInfo };
}

/** GET /portfolios Récupère tous les portfolios de l'utilisateur */
export const handleGetPortfoliosRoute = async (req: VincentAuthenticatedRequest, res: Response) => {
  try {
    const { pkpInfo } = getDataFromJWT(req);
    const portfolios = await PortfolioService.getUserPortfolios(pkpInfo.ethAddress);

    res.json({ data: portfolios, success: true });
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    res.status(500).json({
      data: 'Failed to fetch portfolios',
      success: false,
    });
  }
};

/** POST /portfolios Crée un nouveau portfolio */
export const handleCreatePortfolioRoute = async (
  req: VincentAuthenticatedRequest,
  res: Response
) => {
  try {
    const { app, pkpInfo } = getDataFromJWT(req);
    const portfolioData = CreatePortfolioSchema.parse(req.body);

    const portfolio = await PortfolioService.createPortfolio({
      ethAddress: pkpInfo.ethAddress,
      pkpInfo: {
        publicKey: pkpInfo.publicKey,
        tokenId: pkpInfo.tokenId,
      },
      ...portfolioData,
    });

    res.status(201).json({ data: portfolio, success: true });
  } catch (error) {
    console.error('Error creating portfolio:', error);
    res.status(500).json({
      data: error instanceof Error ? error.message : 'Failed to create portfolio',
      success: false,
    });
  }
};

/** GET /portfolios/:portfolioId Récupère un portfolio spécifique avec ses allocations */
export const handleGetPortfolioRoute = async (req: VincentAuthenticatedRequest, res: Response) => {
  try {
    const { portfolioId } = PortfolioParamsSchema.parse(req.params);
    const { pkpInfo } = getDataFromJWT(req);

    const portfolio = await PortfolioService.getPortfolioWithAllocations(portfolioId);

    // Vérifier que le portfolio appartient à l'utilisateur
    if (portfolio.ethAddress.toLowerCase() !== pkpInfo.ethAddress.toLowerCase()) {
      return res.status(403).json({
        data: 'Access denied',
        success: false,
      });
    }

    res.json({ data: portfolio, success: true });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({
      data: error instanceof Error ? error.message : 'Failed to fetch portfolio',
      success: false,
    });
  }
};

/** PUT /portfolios/:portfolioId/allocations Met à jour les allocations d'un portfolio */
export const handleUpdateAllocationsRoute = async (
  req: VincentAuthenticatedRequest,
  res: Response
) => {
  try {
    const { portfolioId } = PortfolioParamsSchema.parse(req.params);
    const { pkpInfo } = getDataFromJWT(req);
    const { allocations } = UpdateAllocationsSchema.parse(req.body);

    // Vérifier que le portfolio appartient à l'utilisateur
    const portfolio = await PortfolioService.getPortfolioWithAllocations(portfolioId);
    if (portfolio.ethAddress.toLowerCase() !== pkpInfo.ethAddress.toLowerCase()) {
      return res.status(403).json({
        data: 'Access denied',
        success: false,
      });
    }

    const updatedPortfolio = await PortfolioService.updatePortfolioAllocations(
      portfolioId,
      allocations
    );

    res.json({ data: updatedPortfolio, success: true });
  } catch (error) {
    console.error('Error updating allocations:', error);
    res.status(500).json({
      data: error instanceof Error ? error.message : 'Failed to update allocations',
      success: false,
    });
  }
};

/** DELETE /portfolios/:portfolioId Désactive un portfolio */
export const handleDeactivatePortfolioRoute = async (
  req: VincentAuthenticatedRequest,
  res: Response
) => {
  try {
    const { portfolioId } = PortfolioParamsSchema.parse(req.params);
    const { pkpInfo } = getDataFromJWT(req);

    // Vérifier que le portfolio appartient à l'utilisateur
    const portfolio = await PortfolioService.getPortfolioWithAllocations(portfolioId);
    if (portfolio.ethAddress.toLowerCase() !== pkpInfo.ethAddress.toLowerCase()) {
      return res.status(403).json({
        data: 'Access denied',
        success: false,
      });
    }

    await PortfolioService.deactivatePortfolio(portfolioId);

    res.json({ data: 'Portfolio deactivated', success: true });
  } catch (error) {
    console.error('Error deactivating portfolio:', error);
    res.status(500).json({
      data: error instanceof Error ? error.message : 'Failed to deactivate portfolio',
      success: false,
    });
  }
};

/** PUT /portfolios/:portfolioId/settings Met à jour les paramètres d'un portfolio (seuil, fréquence) */
export const handleUpdatePortfolioSettingsRoute = async (
  req: VincentAuthenticatedRequest,
  res: Response
) => {
  try {
    const { portfolioId } = PortfolioParamsSchema.parse(req.params);
    const { pkpInfo } = getDataFromJWT(req);

    // Validation des paramètres
    const settingsSchema = {
      rebalanceThreshold: req.body.rebalanceThreshold
        ? Math.max(0.001, Math.min(0.5, req.body.rebalanceThreshold))
        : undefined,
      monitoringFrequency: req.body.monitoringFrequency || undefined,
    };

    // Vérifier que le portfolio appartient à l'utilisateur
    const portfolio = await PortfolioService.getPortfolioWithAllocations(portfolioId);
    if (portfolio.ethAddress.toLowerCase() !== pkpInfo.ethAddress.toLowerCase()) {
      return res.status(403).json({
        data: 'Access denied',
        success: false,
      });
    }

    // TODO: Implémenter la mise à jour des paramètres dans PortfolioService
    // Pour l'instant, on retourne le portfolio existant

    res.json({ data: portfolio, success: true });
  } catch (error) {
    console.error('Error updating portfolio settings:', error);
    res.status(500).json({
      data: error instanceof Error ? error.message : 'Failed to update portfolio settings',
      success: false,
    });
  }
};
