import { Request, Response } from 'express';
import consola from 'consola';
import { PythService } from '../services/pythService';
import { AssetService } from '../services/assetService';

/** Obtenir les prix actuels de tous les assets */
export async function handleGetPricesRoute(req: Request, res: Response): Promise<void> {
  try {
    consola.info('Récupération des prix actuels...');

    const prices = await PythService.getCurrentPrices();
    const priceArray = Array.from(prices.values());

    res.json({
      success: true,
      data: priceArray,
      count: priceArray.length,
    });
  } catch (error) {
    consola.error('Erreur récupération prix:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération prix',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/** Obtenir le prix d'un asset spécifique */
export async function handleGetPriceRoute(req: Request, res: Response): Promise<void> {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      res.status(400).json({
        success: false,
        error: 'Symbole requis',
      });
      return;
    }

    consola.info(`Récupération prix ${symbol}...`);

    const price = await PythService.getPrice(symbol.toUpperCase());

    if (!price) {
      res.status(404).json({
        success: false,
        error: `Prix non trouvé pour ${symbol}`,
      });
      return;
    }

    res.json({
      success: true,
      data: price,
    });
  } catch (error) {
    consola.error(`Erreur récupération prix ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération prix',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/** Obtenir l'historique des prix d'un asset */
export async function handleGetPriceHistoryRoute(req: Request, res: Response): Promise<void> {
  try {
    const { symbol } = req.params;
    const { hours = '24' } = req.query;

    if (!symbol) {
      res.status(400).json({
        success: false,
        error: 'Symbole requis',
      });
      return;
    }

    const hoursNum = parseInt(hours as string, 10);
    if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 168) {
      res.status(400).json({
        success: false,
        error: 'Heures doit être entre 1 et 168',
      });
      return;
    }

    consola.info(`Récupération historique ${symbol} (${hoursNum}h)...`);

    const history = await PythService.getPriceHistory(symbol.toUpperCase(), hoursNum);

    res.json({
      success: true,
      data: history,
      count: history.length,
      period: `${hoursNum}h`,
    });
  } catch (error) {
    consola.error(`Erreur récupération historique ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération historique',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/** Obtenir les statistiques des prix d'un asset */
export async function handleGetPriceStatsRoute(req: Request, res: Response): Promise<void> {
  try {
    const { symbol } = req.params;
    const { hours = '24' } = req.query;

    if (!symbol) {
      res.status(400).json({
        success: false,
        error: 'Symbole requis',
      });
      return;
    }

    const hoursNum = parseInt(hours as string, 10);
    if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 168) {
      res.status(400).json({
        success: false,
        error: 'Heures doit être entre 1 et 168',
      });
      return;
    }

    consola.info(`Récupération stats ${symbol} (${hoursNum}h)...`);

    const stats = await PythService.getPriceStats(symbol.toUpperCase(), hoursNum);

    res.json({
      success: true,
      data: stats,
      period: `${hoursNum}h`,
    });
  } catch (error) {
    consola.error(`Erreur récupération stats ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération statistiques',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/** Tester la connexion Pyth */
export async function handleTestPythRoute(req: Request, res: Response): Promise<void> {
  try {
    consola.info('Test connexion Pyth...');

    // Test de connexion
    const prices = await PythService.getCurrentPrices();

    // Récupérer les assets actifs
    const assets = await AssetService.getActiveAssets();

    res.json({
      success: true,
      data: {
        connection: 'OK',
        pricesReceived: prices.size,
        assetsConfigured: assets.length,
        assetsWithPythId: assets.filter((a) => a.pythPriceId).length,
        prices: Array.from(prices.values()),
      },
    });
  } catch (error) {
    consola.error('Erreur test Pyth:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur test connexion Pyth',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
