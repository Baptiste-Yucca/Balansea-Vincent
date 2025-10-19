import { useState } from 'react';
import { LIT_EVM_CHAINS } from '@lit-protocol/constants';
import { LITEVMChain } from '@lit-protocol/types';
import { ethers } from 'ethers';

const ERC20_ABI = ['function balanceOf(address owner) view returns (uint256)'];

const WBTC_CONTRACT_ADDRESSES: Record<number, string> = {
  [LIT_EVM_CHAINS.base.chainId]: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
};

const USDC_CONTRACT_ADDRESSES: Record<number, string> = {
  [LIT_EVM_CHAINS.base.chainId]: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
};

export const useChain = () => {
  const [chain, setChain] = useState<LITEVMChain>(LIT_EVM_CHAINS.base);

  const provider = new ethers.providers.JsonRpcProvider(chain.rpcUrls[0]);

  const usdcContract = new ethers.Contract(
    USDC_CONTRACT_ADDRESSES[chain.chainId],
    ERC20_ABI,
    provider
  );

  const wbtcContract = new ethers.Contract(
    WBTC_CONTRACT_ADDRESSES[chain.chainId],
    ERC20_ABI,
    provider
  );

  return {
    chain,
    setChain,
    provider,
    usdcContract,
    wbtcContract,
  };
};
