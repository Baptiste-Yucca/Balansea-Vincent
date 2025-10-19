import { HermesClient } from '@pythnetwork/hermes-client';
import { serviceLogger } from '../logger';
import { PriceData } from '../mongo/models';

export interface PythPrice {
  symbol: string;
  price: number;
  timestamp: Date;
  priceId: string;
}

export class PythService {
  private static client: HermesClient;
  private static isStreaming = false;
  private static eventSource: EventSource | null = null;

  // Price IDs pour les assets supportés
  private static readonly PRICE_IDS = {
    BTC: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    ETH: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    USDC: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a', // Exemple
  };

  static async initialize() {
    try {
      this.client = new HermesClient('https://hermes.pyth.network', {});
      serviceLogger.info('PythService initialisé');
    } catch (error) {
      serviceLogger.error('Erreur initialisation PythService:', error);
      throw error;
    }
  }

  // Récupérer un prix ponctuel (comme votre pyth.js)
  static async getPrice(symbol: keyof typeof PythService.PRICE_IDS): Promise<PythPrice | null> {
    try {
      const priceId = this.PRICE_IDS[symbol];
      const priceIds = [priceId];

      const updates = await this.client.getLatestPriceUpdates(priceIds, {
        parsed: true,
        encoding: 'hex',
      });

      if (updates && updates.parsed && updates.parsed.length > 0) {
        const update = updates.parsed[0];
        const priceInUsd = parseFloat(update.price.price) * Math.pow(10, update.price.expo);

        return {
          symbol,
          price: priceInUsd,
          timestamp: new Date(),
          priceId: update.id,
        };
      }

      return null;
    } catch (error) {
      serviceLogger.error(`Erreur récupération prix ${symbol}:`, error);
      return null;
    }
  }

  // Démarrer le streaming temps réel (comme votre pyth_rts.js)
  static async startPriceStream(): Promise<void> {
    if (this.isStreaming) {
      serviceLogger.warn('Stream Pyth déjà actif');
      return;
    }

    try {
      const priceIds = Object.values(this.PRICE_IDS);

      this.eventSource = await this.client.getPriceUpdatesStream(priceIds, {
        parsed: true,
        encoding: 'hex',
        allowUnordered: true,
        ignoreInvalidPriceIds: true,
      });

      this.isStreaming = true;
      serviceLogger.info('Stream Pyth démarré');

      this.eventSource.onopen = () => {
        serviceLogger.info('Connexion Pyth stream ouverte');
      };

      this.eventSource.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data && data.parsed && Array.isArray(data.parsed)) {
            for (const update of data.parsed) {
              await this.processPriceUpdate(update);
            }
          }
        } catch (error) {
          serviceLogger.error('Erreur traitement message Pyth:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        serviceLogger.error('Erreur stream Pyth:', error);
        this.isStreaming = false;

        // Reconnexion automatique
        setTimeout(() => {
          serviceLogger.info('Tentative de reconnexion Pyth...');
          this.startPriceStream();
        }, 5000);
      };
    } catch (error) {
      serviceLogger.error('Erreur démarrage stream Pyth:', error);
      throw error;
    }
  }

  private static async processPriceUpdate(update: any): Promise<void> {
    try {
      // Identifier le symbole
      const priceId = update.id;
      let symbol = 'UNKNOWN';

      for (const [sym, id] of Object.entries(this.PRICE_IDS)) {
        if (id.substring(2) === priceId) {
          // Enlever "0x"
          symbol = sym;
          break;
        }
      }

      if (symbol === 'UNKNOWN') return;

      // Calculer le prix
      const priceInUsd = parseFloat(update.price.price) * Math.pow(10, update.price.expo);

      // Sauvegarder en base
      await this.savePriceToDatabase(symbol, priceInUsd, update.id);

      serviceLogger.debug(`Prix ${symbol}: $${priceInUsd.toFixed(2)}`);
    } catch (error) {
      serviceLogger.error('Erreur traitement update prix:', error);
    }
  }

  private static async savePriceToDatabase(
    symbol: string,
    price: number,
    priceId: string
  ): Promise<void> {
    try {
      // Récupérer l'asset depuis la base
      const { Asset } = await import('../mongo/models');
      const asset = await Asset.findOne({ symbol, isActive: true });

      if (!asset) {
        serviceLogger.warn(`Asset ${symbol} non trouvé en base`);
        return;
      }

      // Créer l'entrée PriceData
      const priceData = new PriceData({
        assetId: asset._id,
        priceUSD: price,
        timestamp: new Date(),
        source: 'pyth',
      });

      await priceData.save();
    } catch (error) {
      serviceLogger.error('Erreur sauvegarde prix en base:', error);
    }
  }

  static stopPriceStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isStreaming = false;
      serviceLogger.info('Stream Pyth arrêté');
    }
  }
}
