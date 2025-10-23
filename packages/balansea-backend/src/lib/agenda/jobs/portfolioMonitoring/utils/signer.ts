import { ethers } from 'ethers';

import { env } from '../../../../env';

const { BASE_RPC_URL, VINCENT_DELEGATEE_PRIVATE_KEY } = env;

export const readOnlySigner = new ethers.Wallet(
  ethers.Wallet.createRandom().privateKey,
  new ethers.providers.JsonRpcProvider(BASE_RPC_URL)
);

export const delegateeSigner = new ethers.Wallet(
  VINCENT_DELEGATEE_PRIVATE_KEY,
  new ethers.providers.StaticJsonRpcProvider(BASE_RPC_URL) // ex ChronicleRPC
);
