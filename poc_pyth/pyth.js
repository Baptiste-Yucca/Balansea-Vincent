const { HermesClient } = require('@pythnetwork/hermes-client');
//exec node utils/pyth.js
async function getPrices() {
  try {
    const connection = new HermesClient('https://hermes.pyth.network', {});

    const priceIds = [
      // BTC/USD price id
      '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      // ETH/USD price id
      '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    ];

    // Latest price updates
    const priceUpdates = await connection.getLatestPriceUpdates(priceIds);

    // Better display
    for (const update of priceUpdates.parsed) {
      const price = update.price;
      const symbol = update.id === priceIds[0] ? 'BTC' : 'ETH';
      const priceInUsd = price.price * Math.pow(10, price.expo);

      console.log(`${symbol}: $${priceInUsd.toFixed(2)}`);
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des prix:', error);
  }
}

getPrices();
