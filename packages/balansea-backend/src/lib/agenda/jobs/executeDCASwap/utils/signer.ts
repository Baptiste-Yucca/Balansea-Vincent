import { ethers } from 'ethers';

import { env } from '../../../../env';

const { CHRONICLE_YELLOWSTONE_RPC, VINCENT_DELEGATEE_PRIVATE_KEY } = env;

export const readOnlySigner = new ethers.Wallet(
  ethers.Wallet.createRandom().privateKey,
  new ethers.providers.JsonRpcProvider(CHRONICLE_YELLOWSTONE_RPC)
);

export const delegateeSigner = new ethers.Wallet(
  VINCENT_DELEGATEE_PRIVATE_KEY,
  new ethers.providers.StaticJsonRpcProvider(CHRONICLE_YELLOWSTONE_RPC)
);
