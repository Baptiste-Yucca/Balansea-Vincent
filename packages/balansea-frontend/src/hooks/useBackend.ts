import { useCallback } from 'react';

import { useJwtContext, useVincentWebAuthClient } from '@lit-protocol/vincent-app-sdk/react';

import { env } from '@/config/env';

const { VITE_APP_ID, VITE_BACKEND_URL, VITE_REDIRECT_URI } = env;

type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

// Types pour les Assets
export type Asset = {
  _id: string;
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  chainId: number;
  isActive: boolean;
  pythPriceId?: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
};

// Types pour les Allocations
export type Allocation = {
  _id: string;
  portfolioId: string;
  assetId: string;
  targetPercentage: number;
  currentPercentage: number;
  currentValueUSD: number;
  currentBalance: string;
  asset: Asset;
  createdAt: string;
  updatedAt: string;
};

// Types pour les Portfolios
export type Portfolio = {
  _id: string;
  ethAddress: string;
  name: string;
  isActive: boolean;
  rebalanceThreshold: number;
  monitoringFrequency: string;
  rebalanceType: string;
  totalValueUSD: number;
  lastRebalanceAt?: string;
  pkpInfo: {
    publicKey: string;
    tokenId: string;
  };
  allocations: Allocation[];
  createdAt: string;
  updatedAt: string;
};

// Types pour les requêtes
export interface CreatePortfolioRequest {
  name: string;
  allocations: Array<{
    assetSymbol: string;
    targetPercentage: number;
  }>;
  rebalanceThreshold?: number;
  monitoringFrequency?: string;
  rebalanceType?: string;
}

export interface AllocationConfig {
  assetSymbol: string;
  targetPercentage: number;
}

export interface UpdateAllocationsRequest {
  allocations: Array<{
    assetSymbol: string;
    targetPercentage: number;
  }>;
}

export interface UpdatePortfolioSettingsRequest {
  name?: string;
  rebalanceThreshold?: number;
  monitoringFrequency?: string;
  rebalanceType?: string;
  isActive?: boolean;
}

export const useBackend = () => {
  const { authInfo } = useJwtContext();
  const vincentWebAuthClient = useVincentWebAuthClient(VITE_APP_ID);

  const getJwt = useCallback(() => {
    vincentWebAuthClient.redirectToConnectPage({
      redirectUri: VITE_REDIRECT_URI,
    });
  }, [vincentWebAuthClient]);

  const sendRequest = useCallback(
    async <T>(endpoint: string, method: HTTPMethod, body?: unknown): Promise<T> => {
      if (!authInfo?.jwt) {
        throw new Error('No JWT to query backend');
      }

      const headers: HeadersInit = {
        Authorization: `Bearer ${authInfo.jwt}`,
      };
      if (body != null) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(`${VITE_BACKEND_URL}${endpoint}`, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const json = (await response.json()) as { data: T; success: boolean };

      if (!json.success) {
        throw new Error(`Backend error: ${json.data}`);
      }

      return json.data;
    },
    [authInfo]
  );

  // === ASSETS ===
  const getAssets = useCallback(async () => {
    return sendRequest<Asset[]>('/assets', 'GET');
  }, [sendRequest]);

  const getAsset = useCallback(
    async (assetSymbol: string) => {
      return sendRequest<Asset>(`/assets/${assetSymbol}`, 'GET');
    },
    [sendRequest]
  );

  // === PORTFOLIOS ===
  const getPortfolios = useCallback(async () => {
    return sendRequest<Portfolio[]>('/portfolios', 'GET');
  }, [sendRequest]);

  const getPortfolio = useCallback(
    async (portfolioId: string) => {
      return sendRequest<Portfolio>(`/portfolios/${portfolioId}`, 'GET');
    },
    [sendRequest]
  );

  const createPortfolio = useCallback(
    async (portfolio: CreatePortfolioRequest) => {
      return sendRequest<Portfolio>('/portfolios', 'POST', portfolio);
    },
    [sendRequest]
  );

  const updateAllocations = useCallback(
    async (portfolioId: string, allocations: UpdateAllocationsRequest) => {
      return sendRequest<Portfolio>(`/portfolios/${portfolioId}/allocations`, 'PUT', allocations);
    },
    [sendRequest]
  );

  const updatePortfolioSettings = useCallback(
    async (portfolioId: string, settings: UpdatePortfolioSettingsRequest) => {
      return sendRequest<Portfolio>(`/portfolios/${portfolioId}/settings`, 'PUT', settings);
    },
    [sendRequest]
  );

  const deactivatePortfolio = useCallback(
    async (portfolioId: string) => {
      return sendRequest<{ message: string }>(`/portfolios/${portfolioId}`, 'DELETE');
    },
    [sendRequest]
  );

  return {
    // Auth
    getJwt,

    // Assets
    getAssets,
    getAsset,

    // Portfolios
    getPortfolios,
    getPortfolio,
    createPortfolio,
    updateAllocations,
    updatePortfolioSettings,
    deactivatePortfolio,
  };
};
