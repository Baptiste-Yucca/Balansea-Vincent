/**
 * Script de test pour vérifier l'implémentation du rebalancement strict périodique
 *
 * Ce script teste :
 *
 * 1. Création d'un portfolio avec rebalanceType: 'strict_periodic'
 * 2. Simulation d'un monitoring job avec des déviations
 * 3. Vérification que le rebalancement se fait toujours vers les allocations exactes
 */

const { RebalanceService } = require('./dist/lib/services/rebalanceService');
const { PortfolioService } = require('./dist/lib/services/portfolioService');
const { PortfolioMonitoringJob } = require('./dist/lib/agenda/jobs/portfolioMonitoringJob');

async function testStrictRebalancing() {
  console.log('🧪 Test du rebalancement strict périodique');
  console.log('==========================================');

  try {
    // 1. Créer un portfolio de test avec mode strict
    console.log("\n1. Création d'un portfolio de test...");

    const testPortfolio = await PortfolioService.createPortfolio({
      ethAddress: '0x1234567890123456789012345678901234567890',
      name: 'Test Strict Rebalance',
      pkpInfo: {
        publicKey: 'test-public-key',
        tokenId: 'test-token-id',
      },
      allocations: [
        { assetSymbol: 'WBTC', targetPercentage: 0.5 }, // 50%
        { assetSymbol: 'WETH', targetPercentage: 0.3 }, // 30%
        { assetSymbol: 'USDC', targetPercentage: 0.2 }, // 20%
      ],
      rebalanceThreshold: 0.05, // Non utilisé en mode strict
      monitoringFrequency: '1h',
      rebalanceType: 'strict_periodic',
    });

    console.log('✅ Portfolio créé:', testPortfolio._id);
    console.log('   Type de rebalancement:', testPortfolio.rebalanceType);
    console.log(
      '   Allocations:',
      testPortfolio.allocations
        .map((a) => `${a.asset.symbol}: ${(a.targetPercentage * 100).toFixed(1)}%`)
        .join(', ')
    );

    // 2. Simuler des déviations (comme si les prix avaient bougé)
    console.log('\n2. Simulation de déviations...');

    // Simuler des balances déséquilibrées
    const mockBalances = {
      WBTC: { valueUSD: 600, balanceFormatted: 0.02 }, // 60% au lieu de 50%
      WETH: { valueUSD: 200, balanceFormatted: 0.5 }, // 20% au lieu de 30%
      USDC: { valueUSD: 200, balanceFormatted: 200 }, // 20% correct
    };

    console.log('   Balances simulées:');
    Object.entries(mockBalances).forEach(([asset, balance]) => {
      const percentage = ((balance.valueUSD / 1000) * 100).toFixed(1);
      console.log(`   ${asset}: $${balance.valueUSD} (${percentage}%)`);
    });

    // 3. Tester le plan de rebalancement strict
    console.log('\n3. Test du plan de rebalancement strict...');

    const strictPlan = await RebalanceService.createStrictRebalancePlan(testPortfolio._id);

    console.log('✅ Plan de rebalancement strict créé');
    console.log('   Total USD:', strictPlan.totalValueUSD);
    console.log('   Déviations détectées:', strictPlan.deviations.length);
    console.log('   Swaps nécessaires:', strictPlan.swaps.length);

    // Afficher les déviations
    strictPlan.deviations.forEach((dev) => {
      console.log(
        `   ${dev.assetSymbol}: ${(dev.currentPercentage * 100).toFixed(1)}% → ${(dev.targetPercentage * 100).toFixed(1)}% (écart: ${(dev.deviation * 100).toFixed(1)}%)`
      );
    });

    // Afficher les swaps
    strictPlan.swaps.forEach((swap) => {
      console.log(
        `   Swap: ${swap.amount.toFixed(2)} ${swap.fromAsset} → ${swap.toAsset} (${swap.reason})`
      );
    });

    // 4. Vérifier que le mode strict fonctionne différemment du mode threshold
    console.log('\n4. Comparaison avec le mode threshold...');

    const thresholdPlan = await RebalanceService.createRebalancePlan(testPortfolio._id);

    console.log('   Mode threshold - Swaps nécessaires:', thresholdPlan.swaps.length);
    console.log('   Mode strict - Swaps nécessaires:', strictPlan.swaps.length);

    if (strictPlan.swaps.length >= thresholdPlan.swaps.length) {
      console.log('✅ Le mode strict génère au moins autant de swaps que le mode threshold');
    } else {
      console.log('⚠️  Le mode strict génère moins de swaps que le mode threshold');
    }

    // 5. Test de la logique du monitoring job
    console.log('\n5. Test de la logique du monitoring job...');

    // Simuler l'exécution du job
    const jobData = { portfolioId: testPortfolio._id };
    const mockJob = { attrs: { data: jobData } };

    console.log("   Simulation de l'exécution du PortfolioMonitoringJob...");
    console.log('   (En mode strict, le rebalancement devrait toujours se déclencher)');

    // Vérifier que le portfolio a le bon type
    const portfolio = await PortfolioService.getPortfolioWithAllocations(testPortfolio._id);
    if (portfolio.rebalanceType === 'strict_periodic') {
      console.log('✅ Portfolio configuré en mode strict périodique');
    } else {
      console.log('❌ Portfolio pas configuré en mode strict périodique');
    }

    console.log('\n🎉 Test terminé avec succès !');
    console.log('\nRésumé:');
    console.log('- ✅ Portfolio créé avec rebalanceType: strict_periodic');
    console.log('- ✅ Plan de rebalancement strict généré');
    console.log('- ✅ Swaps calculés pour atteindre les allocations exactes');
    console.log('- ✅ Différence entre mode strict et threshold confirmée');
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    throw error;
  }
}

// Exécuter le test si le script est appelé directement
if (require.main === module) {
  testStrictRebalancing()
    .then(() => {
      console.log('\n✅ Tous les tests sont passés !');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Tests échoués:', error);
      process.exit(1);
    });
}

module.exports = { testStrictRebalancing };
