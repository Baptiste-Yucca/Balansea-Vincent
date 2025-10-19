import { Response } from 'express';

import { getAppInfo, getPKPInfo, isAppUser } from '@lit-protocol/vincent-app-sdk/jwt';

import { AssetService } from '../services';
import { VincentAuthenticatedRequest } from './types';
import { AssetParamsSchema, AddAssetSchema } from './portfolioSchema';

function getDataFromJWT(req: VincentAuthenticatedRequest) {
  if (!isAppUser(req.user.decodedJWT)) {
    throw new Error('Vincent JWT is not an app user');
  }

  const app = getAppInfo(req.user.decodedJWT);
  const pkpInfo = getPKPInfo(req.user.decodedJWT);

  return { app, pkpInfo };
}

/** GET /assets Récupère tous les assets actifs */
export const handleGetAssetsRoute = async (req: VincentAuthenticatedRequest, res: Response) => {
  try {
    const assets = await AssetService.getActiveAssets();
    res.json({ data: assets, success: true });
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({
      data: 'Failed to fetch assets',
      success: false,
    });
  }
};

/** GET /assets/:assetSymbol Récupère un asset par son symbole */
export const handleGetAssetRoute = async (req: VincentAuthenticatedRequest, res: Response) => {
  try {
    const { assetSymbol } = AssetParamsSchema.parse(req.params);
    const asset = await AssetService.getAssetBySymbol(assetSymbol);

    if (!asset) {
      return res.status(404).json({
        data: `Asset ${assetSymbol} not found`,
        success: false,
      });
    }

    res.json({ data: asset, success: true });
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({
      data: 'Failed to fetch asset',
      success: false,
    });
  }
};

/** POST /assets Ajoute un nouvel asset (admin seulement pour l'instant) */
export const handleAddAssetRoute = async (req: VincentAuthenticatedRequest, res: Response) => {
  try {
    const { app, pkpInfo } = getDataFromJWT(req);
    const assetData = AddAssetSchema.parse(req.body);

    // TODO: Ajouter une vérification admin basée sur l'App ID
    // Pour l'instant, on permet à tous les utilisateurs d'ajouter des assets

    const asset = await AssetService.addAsset(assetData);
    res.status(201).json({ data: asset, success: true });
  } catch (error) {
    console.error('Error adding asset:', error);
    res.status(500).json({
      data: error instanceof Error ? error.message : 'Failed to add asset',
      success: false,
    });
  }
};

/** DELETE /assets/:assetSymbol Désactive un asset (admin seulement) */
export const handleDeactivateAssetRoute = async (
  req: VincentAuthenticatedRequest,
  res: Response
) => {
  try {
    const { assetSymbol } = AssetParamsSchema.parse(req.params);

    // TODO: Ajouter une vérification admin
    await AssetService.deactivateAsset(assetSymbol);

    res.json({ data: `Asset ${assetSymbol} deactivated`, success: true });
  } catch (error) {
    console.error('Error deactivating asset:', error);
    res.status(500).json({
      data: error instanceof Error ? error.message : 'Failed to deactivate asset',
      success: false,
    });
  }
};
