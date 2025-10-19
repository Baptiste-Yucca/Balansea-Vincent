import React, { useCallback, useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { LogOut, RefreshCcw, Copy, Check, WalletIcon } from 'lucide-react';

import { useJwtContext } from '@lit-protocol/vincent-app-sdk/react';

import { Badge } from '@/components/ui/badge';
import { Box, BoxDescription, BoxTitle } from '@/components/ui/box';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { env } from '@/config/env';
import { useChain } from '@/hooks/useChain';

const { VITE_APP_ID } = env;

const formatAddress = (address: string | undefined) => {
  if (!address) return 'Loading...';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const Wallet: React.FC = () => {
  const { chain, provider, usdcContract, wbtcContract } = useChain();
  const [ethBalance, setEthBalance] = useState<string>('0');
  const [usdcBalance, setUsdcBalance] = useState<string>('0');
  const [wbtcBalance, setWbtcBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const { authInfo, logOut } = useJwtContext();

  // Function to fetch PKP balances
  const fetchPkpBalance = useCallback(async () => {
    if (!authInfo?.pkp.ethAddress) return;

    try {
      setIsLoadingBalance(true);
      setError(null);

      const [ethBalanceWei, usdcBalance, wbtcBalanceWei] = await Promise.all([
        provider.getBalance(authInfo?.pkp.ethAddress),
        usdcContract.balanceOf(authInfo?.pkp.ethAddress),
        wbtcContract.balanceOf(authInfo?.pkp.ethAddress),
      ]);

      setEthBalance(ethers.utils.formatUnits(ethBalanceWei, 18));
      setUsdcBalance(ethers.utils.formatUnits(usdcBalance, 6));
      setWbtcBalance(ethers.utils.formatUnits(wbtcBalanceWei, 8));

      setIsLoadingBalance(false);
    } catch (err: unknown) {
      console.error('Error fetching PKP balances:', err);
      setError(`Failed to fetch wallet balance`);
      setIsLoadingBalance(false);
    }
  }, [authInfo, provider, usdcContract, wbtcContract]);

  useEffect(() => {
    queueMicrotask(() => fetchPkpBalance());
  }, [fetchPkpBalance]);

  const copyAddress = useCallback(async () => {
    const address = authInfo?.pkp.ethAddress;
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy address to clipboard', err);
    }
  }, [authInfo?.pkp.ethAddress]);

  return (
    <Card data-test-id="wallet" className="w-full bg-white p-6 shadow-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Wallet</CardTitle>
      </CardHeader>

      <Separator />

      <CardContent className="text-center">
        <Box className="flex flex-row items-center justify-between">
          <BoxTitle>Wallet Address:</BoxTitle>

          <div className="flex items-center gap-2">
            <a
              href={`${chain.blockExplorerUrls[0]}/address/${authInfo?.pkp.ethAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-80"
              title={authInfo?.pkp.ethAddress}
            >
              {formatAddress(authInfo?.pkp.ethAddress)}
            </a>
            <Button
              variant="outline"
              size="icon"
              onClick={copyAddress}
              disabled={!authInfo?.pkp.ethAddress}
              title={copied ? 'Copied!' : 'Copy address'}
              aria-label="Copy wallet address"
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
        </Box>

        <Separator />

        <Box className="flex flex-row items-stretch justify-between">
          <BoxDescription>Network:</BoxDescription>
          <Badge>{chain.name}</Badge>
        </Box>

        <Separator />

        <Box className="flex flex-row items-stretch justify-between">
          <BoxDescription>ETH Balance:</BoxDescription>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#333',
            }}
          >
            {isLoadingBalance
              ? 'Loading...'
              : `${parseFloat(ethBalance).toFixed(8)} ${chain.symbol}`}
          </span>
        </Box>

        <Box className="flex flex-row items-stretch justify-between">
          <BoxDescription>USDC Balance:</BoxDescription>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#333',
            }}
          >
            {isLoadingBalance ? 'Loading...' : `${parseFloat(usdcBalance).toFixed(6)} USDC`}
          </span>
        </Box>

        <Box className="flex flex-row items-stretch justify-between">
          <BoxDescription>WBTC Balance:</BoxDescription>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#333',
            }}
          >
            {isLoadingBalance ? 'Loading...' : `${parseFloat(wbtcBalance).toFixed(8)} WBTC`}
          </span>
        </Box>

        {error && (
          <div
            style={{
              backgroundColor: '#fff1f0',
              color: '#ff4d4f',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span role="img" aria-label="Error">
              ⚠️
            </span>{' '}
            {error}
          </div>
        )}

        <Button className="w-full" disabled={isLoadingBalance} onClick={fetchPkpBalance}>
          {isLoadingBalance ? (
            <>
              <Spinner variant="destructive" size="sm" /> Refreshing...
            </>
          ) : (
            <>
              <RefreshCcw /> Refresh Balance
            </>
          )}
        </Button>
        <Button
          className="w-full mt-2"
          onClick={() =>
            window.open(
              `https://dashboard.heyvincent.ai/user/appId/${VITE_APP_ID}/wallet`,
              '_blank'
            )
          }
        >
          <WalletIcon /> withdraw with walletconnect
        </Button>
        <Button className="w-full mt-2" variant="destructive" onClick={logOut}>
          <LogOut /> Log Out
        </Button>
      </CardContent>
    </Card>
  );
};
