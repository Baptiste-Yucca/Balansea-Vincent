import { HermesClient } from '@pythnetwork/hermes-client';
import consola from 'consola';
import { Asset, PriceData } from '../mongo/models';

export interface PythPrice {
  symbol: string;
  price: number;
  timestamp: Date;
  confidence: number;
  expo: number;
}

export interface PythPriceUpdate {
  id: string;
  price: {
    price: string;
    expo: number;
    conf: string;
  };
  timestamp: string;
}

export class PythService {
  private static client: HermesClient;
  private static isConnected = false;
  private static readonly HERMES_URL = 'https://hermes.pyth.network';

  /** Initialiser la connexion Pyth */
  private static async initializeClient(): Promise<void> {
    if (!this.client) {
      this.client = new HermesClient(this.HERMES_URL, {});
      consola.info('Client Pyth initialisé');
    }
  }

  /** Obtenir les prix actuels pour tous les assets actifs */
  static async getCurrentPrices(): Promise<Map<string, PythPrice>> {
    try {
      await this.initializeClient();

      // Récupérer tous les assets actifs avec leurs IDs Pyth
      const assets = await Asset.find({
        isActive: true,
        pythPriceId: { $exists: true, $ne: null },
      });

      if (assets.length === 0) {
        consola.warn('Aucun asset avec ID Pyth trouvé');
        return new Map();
      }

      // Extraire les IDs Pyth
      const priceIds = assets.map((asset) => asset.pythPriceId).filter(Boolean);

      consola.info(`Récupération des prix pour ${priceIds.length} assets`);
      consola.info('📋 Assets trouvés:');
      assets.forEach((asset) => {
        consola.info(`  - ${asset.symbol}: ${asset.pythPriceId}`);
      });
      consola.info('🔗 IDs Pyth à récupérer:', priceIds);

      // Récupérer les prix depuis Pyth
      consola.info('🌐 Envoi de la requête à Pyth...');
      const priceUpdates = await this.client.getLatestPriceUpdates(priceIds);
      consola.info('✅ Réponse Pyth reçue:', priceUpdates);

      const prices = new Map<string, PythPrice>();

      for (const update of priceUpdates.parsed) {
        // Trouver l'asset correspondant
        const asset = assets.find((a) => a.pythPriceId === update.id);
        if (!asset) continue;

        const price = update.price;
        const priceInUsd = parseFloat(price.price) * Math.pow(10, price.expo);
        const confidence = parseFloat(price.conf) * Math.pow(10, price.expo);

        prices.set(asset.symbol, {
          symbol: asset.symbol,
          price: priceInUsd,
          timestamp: new Date(),
          confidence,
          expo: price.expo,
        });

        // Sauvegarder en base pour l'historique
        await this.savePriceToDatabase(asset.symbol, priceInUsd, confidence);
      }

      consola.info(`Prix récupérés pour ${prices.size} assets`);
      return prices;
    } catch (error) {
      consola.error('Erreur récupération prix Pyth:', error);
      throw error;
    }
  }

  /** Obtenir le prix d'un asset spécifique */
  static async getPrice(symbol: string): Promise<PythPrice | null> {
    try {
      const asset = await Asset.findOne({
        symbol: symbol.toUpperCase(),
        isActive: true,
        pythPriceId: { $exists: true, $ne: null },
      });

      if (!asset || !asset.pythPriceId) {
        consola.warn(`Asset ${symbol} non trouvé ou sans ID Pyth`);
        return null;
      }

      await this.initializeClient();

      const priceUpdates = await this.client.getLatestPriceUpdates([asset.pythPriceId]);

      if (priceUpdates.parsed.length === 0) {
        consola.warn(`Aucun prix trouvé pour ${symbol}`);
        return null;
      }

      const update = priceUpdates.parsed[0];
      const price = update.price;
      const priceInUsd = parseFloat(price.price) * Math.pow(10, price.expo);
      const confidence = parseFloat(price.conf) * Math.pow(10, price.expo);

      const pythPrice: PythPrice = {
        symbol: asset.symbol,
        price: priceInUsd,
        timestamp: new Date(),
        confidence,
        expo: price.expo,
      };

      // Sauvegarder en base
      await this.savePriceToDatabase(asset.symbol, priceInUsd, confidence);

      return pythPrice;
    } catch (error) {
      consola.error(`Erreur récupération prix ${symbol}:`, error);
      return null;
    }
  }

  /** Démarrer le streaming des prix en temps réel */
  static async startPriceStreaming(): Promise<void> {
    try {
      await this.initializeClient();

      const assets = await Asset.find({
        isActive: true,
        pythPriceId: { $exists: true, $ne: null },
      });

      if (assets.length === 0) {
        consola.warn('Aucun asset avec ID Pyth pour le streaming');
        return;
      }

      const priceIds = assets.map((asset) => asset.pythPriceId).filter(Boolean);

      consola.info(`🚀 Démarrage du streaming Pyth pour ${priceIds.length} assets`);
      consola.info('📋 Assets configurés:');
      assets.forEach((asset) => {
        consola.info(`  - ${asset.symbol}: ${asset.pythPriceId}`);
      });
      consola.info('🔗 IDs Pyth à streamer:', priceIds);

      const streamOptions = {
        parsed: true,
        encoding: 'hex',
        allowUnordered: true,
        ignoreInvalidPriceIds: true,
      };

      consola.info('⚙️ Options de streaming:', streamOptions);

      const testPriceIds = [
        '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43', // BTC/USD
        '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', // ETH/USD
        //'0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a'  // USDC/USD
      ];

      const eventSource = await this.client.getPriceUpdatesStream(testPriceIds, streamOptions);

      let updateCounter = 0;

      eventSource.onopen = () => {
        consola.info('✅ Connexion Pyth ouverte, streaming actif');
      };

      eventSource.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data && data.parsed && Array.isArray(data.parsed)) {
            updateCounter++;
            consola.info(`Message reçu: [${updateCounter}]`);
            for (const update of data.parsed) {
              const normalize = (id: string) => id.toLowerCase().replace(/^0x/, '');
              const asset = assets.find(
                (a) => normalize(a.pythPriceId || '') === normalize(update.id || '')
              );
              if (!asset) continue;

              const price = update.price;
              const priceInUsd = parseFloat(price.price) * Math.pow(10, price.expo);
              const confidence = parseFloat(price.conf) * Math.pow(10, price.expo);

              const timestamp = new Date().toLocaleTimeString('fr-FR');
              consola.info(
                `[${timestamp}] #${updateCounter} ${asset.symbol}: $${priceInUsd.toFixed(2)} (±${confidence.toFixed(2)})`
              );

              // Sauvegarder en base
              await this.savePriceToDatabase(asset.symbol, priceInUsd, confidence);
            }
          } else {
            consola.info('❌ Format de données inattendu:', typeof data);
            //consola.info('Données:', data);
          }
        } catch (parseError) {
          consola.error('❌ Erreur parsing données Pyth:', parseError);
        }
      };

      eventSource.onerror = (error) => {
        consola.error('❌ Erreur streaming Pyth:', error);
        consola.info('🔄 Tentative de reconnexion dans 5 secondes...');

        setTimeout(() => {
          this.startPriceStreaming();
        }, 5000);
      };

      // Gestion de l'arrêt propre
      process.on('SIGINT', () => {
        consola.info('⏹️ Arrêt du streaming Pyth...');
        eventSource.close();
        consola.info('✅ Streaming Pyth arrêté proprement.');
      });
    } catch (error) {
      consola.error('❌ Erreur initialisation streaming Pyth:', error);
      consola.info('🔄 Nouvelle tentative dans 10 secondes...');

      setTimeout(() => {
        this.startPriceStreaming();
      }, 10000);
    }
  }

  /** Sauvegarder un prix en base de données */
  private static async savePriceToDatabase(
    symbol: string,
    price: number,
    confidence: number
  ): Promise<void> {
    try {
      const priceData = new PriceData({
        symbol: symbol.toUpperCase(),
        price,
        confidence,
        source: 'pyth',
        timestamp: new Date(),
      });

      await priceData.save();
    } catch (error) {
      consola.error(`Erreur sauvegarde prix ${symbol}:`, error);
    }
  }

  /** Obtenir l'historique des prix pour un asset */
  static async getPriceHistory(symbol: string, hours: number = 24): Promise<PriceData[]> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      return await PriceData.find({
        symbol: symbol.toUpperCase(),
        source: 'pyth',
        timestamp: { $gte: since },
      }).sort({ timestamp: -1 });
    } catch (error) {
      consola.error(`Erreur récupération historique ${symbol}:`, error);
      return [];
    }
  }

  /** Obtenir le dernier prix enregistré pour un asset */
  static async getLatestPrice(symbol: string): Promise<PriceData | null> {
    try {
      return await PriceData.findOne({
        symbol: symbol.toUpperCase(),
        source: 'pyth',
      }).sort({ timestamp: -1 });
    } catch (error) {
      consola.error(`Erreur récupération dernier prix ${symbol}:`, error);
      return null;
    }
  }

  /** Vérifier si un prix est récent (moins de 5 minutes) */
  static async isPriceRecent(symbol: string, maxAgeMinutes: number = 5): Promise<boolean> {
    try {
      const latestPrice = await this.getLatestPrice(symbol);
      if (!latestPrice) return false;

      const now = new Date();
      const diffMinutes = (now.getTime() - latestPrice.timestamp.getTime()) / (1000 * 60);

      return diffMinutes <= maxAgeMinutes;
    } catch (error) {
      consola.error(`Erreur vérification prix récent ${symbol}:`, error);
      return false;
    }
  }

  /** Obtenir les statistiques des prix */
  static async getPriceStats(
    symbol: string,
    hours: number = 24
  ): Promise<{
    min: number;
    max: number;
    avg: number;
    current: number;
    change24h: number;
  }> {
    try {
      const history = await this.getPriceHistory(symbol, hours);

      if (history.length === 0) {
        return { min: 0, max: 0, avg: 0, current: 0, change24h: 0 };
      }

      const prices = history.map((p) => p.price);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const current = history[0].price;
      const oldest = history[history.length - 1].price;
      const change24h = ((current - oldest) / oldest) * 100;

      return { min, max, avg, current, change24h };
    } catch (error) {
      consola.error(`Erreur calcul stats ${symbol}:`, error);
      return { min: 0, max: 0, avg: 0, current: 0, change24h: 0 };
    }
  }
}
