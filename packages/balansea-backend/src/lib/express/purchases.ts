import { Response } from 'express';

import { getPKPInfo } from '@lit-protocol/vincent-app-sdk/jwt';

import { VincentAuthenticatedRequest } from './types';
import { PurchasedCoin } from '../mongo/models/PurchasedCoin';

export const handleListPurchasesRoute = async (req: VincentAuthenticatedRequest, res: Response) => {
  const { ethAddress } = getPKPInfo(req.user.decodedJWT);

  const purchases = await PurchasedCoin.find({ ethAddress })
    .sort({
      createdAt: -1,
    })
    .lean();

  if (purchases.length === 0) {
    res.status(404).json({ error: `No purchases found  for wallet address ${ethAddress}` });
    return;
  }

  res.json({ data: purchases, success: true });
};
