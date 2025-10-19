import consola from 'consola';
import { Asset } from '../mongo/models';

const logger = consola.withTag('AssetService');

// Assets par défaut pour Base
const DEFAULT_ASSETS = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC sur Base
    decimals: 6,
    chainId: 8453,
    pythPriceId: 'eaa020c61cc4797128134ce4e4c4d4e4d4e4d4e4d4e4d4e4d4e4d4e4d4e4d4e', // À remplacer par le vrai ID Pyth
    logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ethereum',
    address: '0x4200000000000000000000000000000000000006', // WETH sur Base
    decimals: 18,
    chainId: 8453,
    pythPriceId: 'eaa020c61cc4797128134ce4e4c4d4e4d4e4d4e4d4e4d4e4d4e4d4e4d4e4d4e', // À remplacer par le vrai ID Pyth
    logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', // WBTC sur Base
    decimals: 8,
    chainId: 8453,
    pythPriceId: 'eaa020c61cc4797128134ce4e4c4d4e4d4e4d4e4d4e4d4e4d4e4d4e4d4e4d4e', // À remplacer par le vrai ID Pyth
    logoUrl: 'https://cryptologos.cc/logos/wrapped-bitcoin-wbtc-logo.png',
  },
];

export class AssetService {
  /** Initialise les assets par défaut s'ils n'existent pas */
  static async initializeDefaultAssets(): Promise<void> {
    try {
      logger.log('Initializing default assets...');

      for (const assetData of DEFAULT_ASSETS) {
        const existingAsset = await Asset.findOne({
          symbol: assetData.symbol,
          chainId: assetData.chainId,
        });

        if (!existingAsset) {
          const asset = new Asset(assetData);
          await asset.save();
          logger.log(`Created asset: ${assetData.symbol}`);
        } else {
          logger.log(`Asset already exists: ${assetData.symbol}`);
        }
      }

      logger.log('Default assets initialization completed');
    } catch (error) {
      logger.error('Error initializing default assets:', error);
      throw error;
    }
  }

  /** Récupère tous les assets actifs */
  static async getActiveAssets(): Promise<any[]> {
    try {
      return await Asset.find({ isActive: true }).sort({ symbol: 1 });
    } catch (error) {
      logger.error('Error fetching active assets:', error);
      throw error;
    }
  }

  /** Récupère un asset par son symbole */
  static async getAssetBySymbol(symbol: string): Promise<any | null> {
    try {
      return await Asset.findOne({
        symbol: symbol.toUpperCase(),
        isActive: true,
      });
    } catch (error) {
      logger.error(`Error fetching asset ${symbol}:`, error);
      throw error;
    }
  }

  /** Récupère un asset par son adresse */
  static async getAssetByAddress(address: string, chainId: number = 8453): Promise<any | null> {
    try {
      return await Asset.findOne({
        address: address.toLowerCase(),
        chainId,
        isActive: true,
      });
    } catch (error) {
      logger.error(`Error fetching asset by address ${address}:`, error);
      throw error;
    }
  }

  /** Ajoute un nouvel asset */
  static async addAsset(assetData: {
    symbol: string;
    name: string;
    address: string;
    decimals: number;
    chainId?: number;
    pythPriceId?: string;
    logoUrl?: string;
  }): Promise<any> {
    try {
      // Vérifier si l'asset existe déjà
      const existingAsset = await Asset.findOne({
        $or: [
          { symbol: assetData.symbol.toUpperCase() },
          { address: assetData.address.toLowerCase() },
        ],
      });

      if (existingAsset) {
        throw new Error(
          `Asset with symbol ${assetData.symbol} or address ${assetData.address} already exists`
        );
      }

      const asset = new Asset({
        ...assetData,
        symbol: assetData.symbol.toUpperCase(),
        address: assetData.address.toLowerCase(),
        chainId: assetData.chainId || 8453,
        isActive: true,
      });

      await asset.save();
      logger.log(`Added new asset: ${assetData.symbol}`);
      return asset;
    } catch (error) {
      logger.error('Error adding asset:', error);
      throw error;
    }
  }

  /** Désactive un asset */
  static async deactivateAsset(symbol: string): Promise<void> {
    try {
      const asset = await Asset.findOne({ symbol: symbol.toUpperCase() });
      if (!asset) {
        throw new Error(`Asset ${symbol} not found`);
      }

      asset.isActive = false;
      await asset.save();
      logger.log(`Deactivated asset: ${symbol}`);
    } catch (error) {
      logger.error(`Error deactivating asset ${symbol}:`, error);
      throw error;
    }
  }
}
