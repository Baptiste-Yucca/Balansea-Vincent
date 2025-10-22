/** Script de test pour vérifier l'API des assets */

const fetch = require('node-fetch');

async function testAssetsAPI() {
  console.log("🧪 Test de l'API des assets");
  console.log('============================');

  const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3001';

  try {
    // 1. Test de l'endpoint /assets
    console.log(`\n1. Test de l'endpoint ${BACKEND_URL}/assets...`);

    const response = await fetch(`${BACKEND_URL}/assets`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Note: En mode dev, l'authentification Vincent pourrait être désactivée
      },
    });

    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Réponse reçue:', data);

      if (data.success && data.data) {
        console.log(`✅ ${data.data.length} assets trouvés:`);
        data.data.forEach((asset) => {
          console.log(`   - ${asset.symbol}: ${asset.name}`);
        });
      } else {
        console.log('❌ Format de réponse incorrect:', data);
      }
    } else {
      const errorText = await response.text();
      console.log('❌ Erreur HTTP:', errorText);
    }
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

// Exécuter le test si le script est appelé directement
if (require.main === module) {
  testAssetsAPI()
    .then(() => {
      console.log('\n✅ Test terminé !');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test échoué:', error);
      process.exit(1);
    });
}

module.exports = { testAssetsAPI };
