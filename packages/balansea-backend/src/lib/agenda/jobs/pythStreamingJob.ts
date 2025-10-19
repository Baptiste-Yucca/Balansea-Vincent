import consola from 'consola';
import { PythService } from '../../services/pythService';

export class PythStreamingJob {
  /** Démarrer le streaming Pyth au démarrage du serveur */
  static async startStreaming(): Promise<void> {
    try {
      consola.info('🚀 Démarrage du streaming Pyth...');

      // Démarrer le streaming en arrière-plan
      PythService.startPriceStreaming().catch((error) => {
        consola.error('Erreur streaming Pyth:', error);
      });

      consola.info('✅ Streaming Pyth démarré');
    } catch (error) {
      consola.error('Erreur démarrage streaming Pyth:', error);
      throw error;
    }
  }

  /** Arrêter le streaming Pyth */
  static async stopStreaming(): Promise<void> {
    try {
      consola.info('⏹️ Arrêt du streaming Pyth...');
      // Le streaming s'arrête automatiquement avec SIGINT
      consola.info('✅ Streaming Pyth arrêté');
    } catch (error) {
      consola.error('Erreur arrêt streaming Pyth:', error);
    }
  }

  /** Tester la connexion Pyth */
  static async testConnection(): Promise<void> {
    try {
      consola.info('🧪 Test de connexion Pyth...');

      // Test simple avec les IDs de votre POC
      const testPriceIds = [
        '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43', // BTC/USD
        '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', // ETH/USD
        '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a', // USDC/USD
      ];

      consola.info('🔗 Test avec les IDs Pyth du POC:', testPriceIds);

      const { HermesClient } = await import('@pythnetwork/hermes-client');
      const client = new HermesClient('https://hermes.pyth.network', {});

      consola.info('🌐 Envoi requête test...');
      const priceUpdates = await client.getLatestPriceUpdates(testPriceIds);

      consola.info('✅ Test réussi !');

      if (priceUpdates.parsed && priceUpdates.parsed.length > 0) {
        consola.info(`📊 ${priceUpdates.parsed.length} prix récupérés:`);
        for (const update of priceUpdates.parsed) {
          const price = update.price;
          const priceInUsd = parseFloat(price.price) * Math.pow(10, price.expo);
          const symbol = update.id === testPriceIds[0] ? 'BTC' : 'ETH';
          consola.info(`  ${symbol}: $${priceInUsd.toFixed(2)}`);
        }
      } else {
        consola.warn('⚠️ Aucun prix dans la réponse');
      }
    } catch (error) {
      consola.error('❌ Test connexion Pyth échoué:', error);
      throw error;
    }
  }
}
