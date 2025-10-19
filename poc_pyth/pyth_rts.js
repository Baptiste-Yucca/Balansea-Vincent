const { HermesClient } = require('@pythnetwork/hermes-client');

//exec node utils/pyth_rts.js
async function getRealTimePrices() {
  try {
    const connection = new HermesClient('https://hermes.pyth.network', {});

    const priceIds = [
      // BTC/USD price id
      '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      // ETH/USD price id
      '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    ];

    console.log('🚀 Démarrage du streaming des prix en temps réel...');
    console.log('📊 Surveillance des prix BTC et ETH');
    console.log('⏹️  Appuyez sur Ctrl+C pour arrêter\n');

    // Streaming price updates
    const eventSource = await connection.getPriceUpdatesStream(priceIds, {
      parsed: true,
      encoding: 'hex',
      allowUnordered: true,
      ignoreInvalidPriceIds: true,
    });

    console.log('🔗 Connexion au stream établie, en attente des données...');

    let updateCounter = 0;

    eventSource.onopen = () => {
      console.log('✅ Connexion ouverte, streaming actif\n');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Traiter chaque mise à jour de prix
        if (data && data.parsed && Array.isArray(data.parsed)) {
          updateCounter++;

          for (const update of data.parsed) {
            const priceId = update.id;
            const price = update.price;

            // Identifier le symbole (enlever le préfixe 0x pour la comparaison)
            let symbol = 'UNKNOWN';
            const btcId = priceIds[0].substring(2); // Enlever "0x"
            const ethId = priceIds[1].substring(2); // Enlever "0x"

            if (priceId === btcId) {
              symbol = 'BTC';
            } else if (priceId === ethId) {
              symbol = 'ETH';
            }
            // Calculer le prix en USD avec la formule correcte
            const priceInUsd = parseFloat(price.price) * Math.pow(10, price.expo);
            const timestamp = new Date().toLocaleTimeString('fr-FR');

            console.log(`[${timestamp}] #${updateCounter} ${symbol}: $${priceInUsd.toFixed(2)}`);
          }
        } else {
          console.log('⚠️  Format de données inattendu:', typeof data);
        }
      } catch (parseError) {
        console.error('❌ Erreur lors du parsing des données:', parseError);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ Erreur lors de la réception des mises à jour:', error);
      console.log('🔄 Tentative de reconnexion...');
      eventSource.close();

      // Reconnexion automatique après 5 secondes
      setTimeout(() => {
        console.log('🔄 Reconnexion...');
        getRealTimePrices();
      }, 5000);
    };

    // Gestion de l'arrêt propre avec Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n⏹️  Arrêt du streaming des prix...');
      eventSource.close();
      console.log('✅ Streaming arrêté proprement.');
      process.exit(0);
    });

    // Garder le processus en vie
    await new Promise(() => {});
  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation du streaming:", error);
    console.log('🔄 Nouvelle tentative dans 10 secondes...');

    setTimeout(() => {
      getRealTimePrices();
    }, 10000);
  }
}

getRealTimePrices();
