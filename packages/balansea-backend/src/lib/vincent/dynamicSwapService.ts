import { ethers } from 'ethers';
import consola from 'consola';
import {
  getErc20ApprovalToolClient,
  getSignedUniswapQuote,
  getUniswapToolClient,
} from '../agenda/jobs/executeDCASwap/vincentAbilities';
import { env } from '../env';

const { BASE_RPC_URL } = env;

// Adresses des tokens sur Base Mainnet
const TOKEN_ADDRESSES = {
  USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  WETH: '0x4200000000000000000000000000000000000006',
  WBTC: '0x0555e30da8f98308edb960aa94c0db47230d2b9c',
} as const;

// Décimaux des tokens
const TOKEN_DECIMALS = {
  USDC: 6,
  WETH: 18,
  WBTC: 8,
} as const;

// Router Uniswap V3 sur Base
const UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';

export interface SwapParams {
  fromToken: keyof typeof TOKEN_ADDRESSES;
  toToken: keyof typeof TOKEN_ADDRESSES;
  amount: number; // Montant en unités du token source
  recipient: string; // Adresse du destinataire
}

export interface SwapResult {
  txHash: string;
  fromToken: string;
  toToken: string;
  amountIn: string;
  amountOut: string;
  dex: 'uniswap';
}

export class DynamicSwapService {
  /** Exécuter un swap dynamique entre deux tokens */
  static async executeSwap(params: SwapParams): Promise<SwapResult> {
    const { fromToken, toToken, amount, recipient } = params;

    try {
      consola.info(`Exécution swap: ${amount} ${fromToken} → ${toToken}`);

      // 1. Vérifier que les tokens sont différents
      if (fromToken === toToken) {
        throw new Error('Impossible de swapper un token avec lui-même');
      }

      // 2. Récupérer les adresses et décimaux
      const fromTokenAddress = TOKEN_ADDRESSES[fromToken];
      const toTokenAddress = TOKEN_ADDRESSES[toToken];
      const fromTokenDecimals = TOKEN_DECIMALS[fromToken];

      // 3. Convertir le montant en BigNumber
      const amountBN = ethers.utils.parseUnits(amount.toString(), fromTokenDecimals);

      // 4. Approuver le token source (si nécessaire)
      const approvalHash = await this.handleTokenApproval({
        tokenAddress: fromTokenAddress,
        tokenAmount: amountBN,
        spenderAddress: UNISWAP_V3_ROUTER,
        delegatorAddress: recipient,
      });

      // 5. Exécuter le swap
      const swapHash = await this.executeUniswapSwap({
        fromTokenAddress,
        toTokenAddress,
        fromTokenDecimals,
        amountBN,
        recipient,
      });

      consola.info(`Swap réussi: ${swapHash}`);

      return {
        txHash: swapHash,
        fromToken,
        toToken,
        amountIn: amount.toString(),
        amountOut: '0', // Sera calculé par Uniswap
        dex: 'uniswap',
      };
    } catch (error) {
      consola.error(`Erreur swap ${fromToken} → ${toToken}:`, error);
      throw error;
    }
  }

  /** Exécuter plusieurs swaps pour le rééquilibrage */
  static async executeRebalanceSwaps(
    swaps: Array<{
      fromAsset: string;
      toAsset: string;
      amount: number;
      recipient: string;
    }>
  ): Promise<SwapResult[]> {
    const results: SwapResult[] = [];

    for (const swap of swaps) {
      try {
        const result = await this.executeSwap({
          fromToken: swap.fromAsset as keyof typeof TOKEN_ADDRESSES,
          toToken: swap.toAsset as keyof typeof TOKEN_ADDRESSES,
          amount: swap.amount,
          recipient: swap.recipient,
        });
        results.push(result);
      } catch (error) {
        consola.error(`Échec swap ${swap.fromAsset} → ${swap.toAsset}:`, error);
        // Continuer avec les autres swaps même si un échoue
      }
    }

    return results;
  }

  /** Gérer l'approbation du token */
  private static async handleTokenApproval({
    tokenAddress,
    tokenAmount,
    spenderAddress,
    delegatorAddress,
  }: {
    tokenAddress: string;
    tokenAmount: ethers.BigNumber;
    spenderAddress: string;
    delegatorAddress: string;
  }): Promise<string | undefined> {
    const erc20ApprovalToolClient = getErc20ApprovalToolClient();

    const approvalParams = {
      chainId: 8453, // Base Mainnet
      rpcUrl: BASE_RPC_URL,
      spenderAddress,
      tokenAddress,
      tokenAmount: tokenAmount.mul(5).toString(), // Approve 5x pour éviter les approbations répétées
    };

    const approvalContext = {
      delegatorPkpEthAddress: delegatorAddress,
    };

    // Vérifier si l'approbation est nécessaire
    const precheckResult = await erc20ApprovalToolClient.precheck(approvalParams, approvalContext);

    if (!precheckResult.success) {
      throw new Error(`Precheck approbation échoué: ${precheckResult}`);
    }

    if (precheckResult.result.alreadyApproved) {
      consola.info('Approbation déjà suffisante');
      return undefined;
    }

    // Exécuter l'approbation
    const executionResult = await erc20ApprovalToolClient.execute(approvalParams, approvalContext);

    if (!executionResult.success) {
      throw new Error(`Exécution approbation échouée: ${executionResult}`);
    }

    return executionResult.result.approvalTxHash as string;
  }

  /** Exécuter le swap Uniswap */
  private static async executeUniswapSwap({
    fromTokenAddress,
    toTokenAddress,
    fromTokenDecimals,
    amountBN,
    recipient,
  }: {
    fromTokenAddress: string;
    toTokenAddress: string;
    fromTokenDecimals: number;
    amountBN: ethers.BigNumber;
    recipient: string;
  }): Promise<string> {
    // 1. Obtenir le quote signé d'Uniswap
    const signedQuote = await getSignedUniswapQuote({
      tokenInAddress: fromTokenAddress,
      tokenOutAddress: toTokenAddress,
      recipient,
      rpcUrl: BASE_RPC_URL,
      tokenInAmount: ethers.utils.formatUnits(amountBN, fromTokenDecimals),
    });

    // 2. Exécuter le swap via Vincent
    const uniswapToolClient = getUniswapToolClient();

    const swapParams = {
      signedUniswapQuote: signedQuote,
      rpcUrlForUniswap: BASE_RPC_URL,
    };

    const swapContext = {
      delegatorPkpEthAddress: recipient,
    };

    // 3. Precheck
    const precheckResult = await uniswapToolClient.precheck(swapParams, swapContext);
    if (!precheckResult.success) {
      throw new Error(`Precheck Uniswap échoué: ${precheckResult}`);
    }

    // 4. Exécution
    const executionResult = await uniswapToolClient.execute(swapParams, swapContext);
    if (!executionResult.success) {
      throw new Error(`Exécution Uniswap échouée: ${executionResult}`);
    }

    return executionResult.result.swapTxHash as string;
  }

  /** Obtenir l'adresse d'un token */
  static getTokenAddress(symbol: string): string {
    const address = TOKEN_ADDRESSES[symbol as keyof typeof TOKEN_ADDRESSES];
    if (!address) {
      throw new Error(`Token non supporté: ${symbol}`);
    }
    return address;
  }

  /** Obtenir les décimaux d'un token */
  static getTokenDecimals(symbol: string): number {
    const decimals = TOKEN_DECIMALS[symbol as keyof typeof TOKEN_DECIMALS];
    if (decimals === undefined) {
      throw new Error(`Décimaux non trouvés pour: ${symbol}`);
    }
    return decimals;
  }
}
