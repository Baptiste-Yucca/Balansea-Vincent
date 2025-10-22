import consola from 'consola';
import { ethers } from 'ethers';
import { SwapOperation } from './rebalanceUtils';
import { Portfolio } from '../../../../mongo/models';
import { env } from '../../../../env';

const { BASE_RPC_URL, VINCENT_APP_ID } = env;

const BASE_CHAIN_ID = 8453;
const BASE_UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';

const baseProvider = new ethers.providers.StaticJsonRpcProvider(BASE_RPC_URL);

// Token addresses on Base
const TOKEN_ADDRESSES = {
  USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  WBTC: '0x0555e30da8f98308edb960aa94c0db47230d2b9c',
  WETH: '0x4200000000000000000000000000000000000006',
};

const TOKEN_DECIMALS = {
  USDC: 6,
  WBTC: 8,
  WETH: 18,
};

/** Execute a single swap operation using Uniswap via Vincent abilities */
export async function executeSwap(
  swap: SwapOperation,
  ethAddress: string,
  pkpPublicKey: string
): Promise<string> {
  consola.info(
    `Executing swap: ${swap.amountInUSD.toFixed(2)} USD ${swap.tokenInSymbol} -> ${swap.tokenOutSymbol}`
  );

  try {
    // 1. Handle token approval if needed
    const approvalHash = await handleTokenApproval(
      swap.tokenInAddress,
      swap.amountInTokens,
      ethAddress
    );

    if (approvalHash) {
      consola.info(`Token approval tx: ${approvalHash}`);
      // Wait for approval confirmation if needed
      await waitForTransaction(approvalHash);
    }

    // 2. Execute the swap
    const swapHash = await executeUniswapSwap(swap, ethAddress, pkpPublicKey);

    consola.info(`Swap executed successfully: ${swapHash}`);
    return swapHash;
  } catch (error) {
    consola.error(`Swap execution failed:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to execute swap ${swap.tokenInSymbol} -> ${swap.tokenOutSymbol}: ${errorMessage}`
    );
  }
}

/** Execute multiple swaps in sequence for portfolio rebalancing */
export async function executeRebalanceSwaps(
  swaps: SwapOperation[],
  portfolioId: string
): Promise<string[]> {
  consola.info(`Executing ${swaps.length} swaps for portfolio ${portfolioId}`);

  // Get portfolio to get ethAddress and pkpPublicKey
  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) {
    throw new Error(`Portfolio ${portfolioId} not found`);
  }

  if (!portfolio.ethAddress || !portfolio.pkpInfo?.publicKey) {
    throw new Error(`Portfolio ${portfolioId} missing ethAddress or pkpInfo.publicKey`);
  }

  const txHashes: string[] = [];

  // Execute swaps in order (already sorted by priority)
  for (let i = 0; i < swaps.length; i++) {
    const swap = swaps[i];
    consola.info(
      `Executing swap ${i + 1}/${swaps.length}: ${swap.tokenInSymbol} -> ${swap.tokenOutSymbol}`
    );

    try {
      const txHash = await executeSwap(swap, portfolio.ethAddress, portfolio.pkpInfo.publicKey);
      txHashes.push(txHash);

      // Wait for transaction confirmation before next swap
      await waitForTransaction(txHash);

      consola.info(`Swap ${i + 1} completed: ${txHash}`);
    } catch (error) {
      consola.error(`Swap ${i + 1} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Stop execution on first failure (strict mode)
      throw new Error(`Rebalancing stopped at swap ${i + 1}: ${errorMessage}`);
    }
  }

  consola.info(`All ${swaps.length} swaps completed successfully`);
  return txHashes;
}

/** Handle ERC20 token approval for Uniswap router */
async function handleTokenApproval(
  tokenAddress: string,
  amount: string,
  ethAddress: string
): Promise<string | undefined> {
  // Import Vincent abilities dynamically to avoid circular dependencies
  const { getErc20ApprovalToolClient } = await import('../../executeDCASwap/vincentAbilities');
  const { alchemyGasSponsor, alchemyGasSponsorApiKey, alchemyGasSponsorPolicyId } = await import(
    '../../executeDCASwap/utils'
  );

  const erc20ApprovalToolClient = getErc20ApprovalToolClient();
  const approvalParams = {
    alchemyGasSponsor,
    alchemyGasSponsorApiKey,
    alchemyGasSponsorPolicyId,
    chainId: BASE_CHAIN_ID,
    rpcUrl: BASE_RPC_URL,
    spenderAddress: BASE_UNISWAP_V3_ROUTER,
    tokenAddress,
    tokenAmount: ethers.BigNumber.from(amount).mul(2).toString(), // Approve 2x to avoid frequent approvals
  };
  const approvalContext = {
    delegatorPkpEthAddress: ethAddress,
  };

  // Check if approval is needed
  const approvalPrecheckResult = await erc20ApprovalToolClient.precheck(
    approvalParams,
    approvalContext
  );

  if (!approvalPrecheckResult.success) {
    throw new Error(`ERC20 approval tool precheck failed: ${approvalPrecheckResult}`);
  }

  if (approvalPrecheckResult.result.alreadyApproved) {
    consola.info(`Token ${tokenAddress} already approved`);
    return undefined;
  }

  // Execute approval
  const approvalExecutionResult = await erc20ApprovalToolClient.execute(
    approvalParams,
    approvalContext
  );

  if (!approvalExecutionResult.success) {
    throw new Error(`ERC20 approval tool execution failed: ${approvalExecutionResult}`);
  }

  return approvalExecutionResult.result.approvalTxHash as string;
}

/** Execute Uniswap swap using Vincent abilities */
async function executeUniswapSwap(
  swap: SwapOperation,
  ethAddress: string,
  pkpPublicKey: string
): Promise<string> {
  // Import Vincent abilities dynamically
  const { getSignedUniswapQuote, getUniswapToolClient } = await import(
    '../../executeDCASwap/vincentAbilities'
  );
  const { handleOperationExecution, getUserPermittedVersion } = await import(
    '../../executeDCASwap/utils'
  );
  const { assertPermittedVersion } = await import('../../jobVersion');
  const { env } = await import('../../../../env');
  const { VINCENT_APP_ID } = env;

  // Check user permissions for Vincent app
  consola.info(`Checking permissions for user ${ethAddress}`);
  const userPermittedAppVersion = await getUserPermittedVersion({
    ethAddress,
    appId: VINCENT_APP_ID,
  });

  if (!userPermittedAppVersion) {
    throw new Error(`User ${ethAddress} revoked permission to run this app`);
  }

  // Use the permitted app version (default to version 1 for now)
  const appVersion = 1;
  const appVersionToRun = assertPermittedVersion(appVersion, userPermittedAppVersion);

  consola.info(`Using app version ${appVersionToRun} for user ${ethAddress}`);

  // Get signed quote from Uniswap
  const signedUniswapQuote = await getSignedUniswapQuote({
    tokenInAddress: swap.tokenInAddress,
    tokenOutAddress: swap.tokenOutAddress,
    recipient: ethAddress,
    rpcUrl: BASE_RPC_URL,
    tokenInAmount: ethers.utils.formatUnits(swap.amountInTokens, swap.tokenInDecimals),
  });

  const uniswapToolClient = getUniswapToolClient();
  const swapParams = {
    signedUniswapQuote,
    rpcUrlForUniswap: BASE_RPC_URL,
  };
  const swapContext = {
    delegatorPkpEthAddress: ethAddress,
  };

  // Precheck swap
  const swapPrecheckResult = await uniswapToolClient.precheck(swapParams, swapContext);
  if (!swapPrecheckResult.success) {
    throw new Error(`Uniswap tool precheck failed: ${swapPrecheckResult}`);
  }

  // Execute swap
  const swapExecutionResult = await uniswapToolClient.execute(swapParams, swapContext);
  if (!swapExecutionResult.success) {
    throw new Error(`Uniswap tool execution failed: ${swapExecutionResult}`);
  }

  const swapTxHash = swapExecutionResult.result.swapTxHash as `0x${string}`;

  // Handle operation execution (gas sponsorship)
  await handleOperationExecution({
    isSponsored: true, // Using Alchemy gas sponsorship
    operationHash: swapTxHash,
    pkpPublicKey,
    provider: baseProvider,
  });

  return swapTxHash as `0x${string}`;
}

/** Wait for transaction confirmation */
async function waitForTransaction(txHash: string, maxWaitTime: number = 60000): Promise<void> {
  consola.info(`Waiting for transaction confirmation: ${txHash}`);

  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const receipt = await baseProvider.getTransactionReceipt(txHash);
      if (receipt && receipt.status === 1) {
        consola.info(`Transaction confirmed: ${txHash}`);
        return;
      }
    } catch (error) {
      // Transaction not yet mined, continue waiting
    }

    // Wait 2 seconds before checking again
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Transaction ${txHash} not confirmed within ${maxWaitTime}ms`);
}

/** Get token address by symbol */
export function getTokenAddress(symbol: string): string {
  const address = TOKEN_ADDRESSES[symbol.toUpperCase() as keyof typeof TOKEN_ADDRESSES];
  if (!address) {
    throw new Error(`Unknown token symbol: ${symbol}`);
  }
  return address;
}

/** Get token decimals by symbol */
export function getTokenDecimals(symbol: string): number {
  const decimals = TOKEN_DECIMALS[symbol.toUpperCase() as keyof typeof TOKEN_DECIMALS];
  if (decimals === undefined) {
    throw new Error(`Unknown token symbol: ${symbol}`);
  }
  return decimals;
}
