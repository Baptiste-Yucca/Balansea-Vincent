import * as Sentry from '@sentry/node';
import cors from 'cors';
import express, { Express, NextFunction, Response } from 'express';
import helmet from 'helmet';

import { createVincentUserMiddleware } from '@lit-protocol/vincent-app-sdk/expressMiddleware';
import { getAppInfo, getPKPInfo, isAppUser } from '@lit-protocol/vincent-app-sdk/jwt';

import { handleListPurchasesRoute } from './purchases';
import {
  handleListSchedulesRoute,
  handleEnableScheduleRoute,
  handleDisableScheduleRoute,
  handleCreateScheduleRoute,
  handleDeleteScheduleRoute,
  handleEditScheduleRoute,
} from './schedules';
import {
  handleGetAssetsRoute,
  handleGetAssetRoute,
  handleAddAssetRoute,
  handleDeactivateAssetRoute,
} from './assets';
import {
  handleGetPricesRoute,
  handleGetPriceRoute,
  handleGetPriceHistoryRoute,
  handleGetPriceStatsRoute,
  handleTestPythRoute,
} from './prices';
import {
  handleGetPortfoliosRoute,
  handleCreatePortfolioRoute,
  handleGetPortfolioRoute,
  handleUpdateAllocationsRoute,
  handleDeactivatePortfolioRoute,
  handleUpdatePortfolioSettingsRoute,
} from './portfolios';
import { userKey, VincentAuthenticatedRequest } from './types';
import { env } from '../env';
import { serviceLogger } from '../logger';

const { ALLOWED_AUDIENCE, CORS_ALLOWED_DOMAIN, IS_DEVELOPMENT, VINCENT_APP_ID } = env;

const { handler, middleware } = createVincentUserMiddleware({
  userKey,
  allowedAudience: ALLOWED_AUDIENCE,
  requiredAppId: VINCENT_APP_ID,
});

const corsConfig = {
  optionsSuccessStatus: 204,
  origin: IS_DEVELOPMENT ? true : [CORS_ALLOWED_DOMAIN],
};

const setSentryUserMiddleware = handler(
  (req: VincentAuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!isAppUser(req.user.decodedJWT)) {
      throw new Error('Vincent JWT is not an app user');
    }

    Sentry.setUser({
      app: getAppInfo(req.user.decodedJWT),
      ethAddress: getPKPInfo(req.user.decodedJWT).ethAddress,
    });
    next();
  }
);

export const registerRoutes = (app: Express) => {
  app.use(helmet());
  app.use(express.json());

  if (IS_DEVELOPMENT) {
    serviceLogger.info(`CORS is disabled for development`);
  } else {
    serviceLogger.info(`Configuring CORS with allowed domain: ${CORS_ALLOWED_DOMAIN}`);
  }
  app.use(cors(corsConfig));

  // Routes DCA existantes (à garder pour compatibilité)
  app.get('/purchases', middleware, setSentryUserMiddleware, handler(handleListPurchasesRoute));
  app.get('/schedules', middleware, setSentryUserMiddleware, handler(handleListSchedulesRoute));
  app.post('/schedule', middleware, setSentryUserMiddleware, handler(handleCreateScheduleRoute));
  app.put(
    '/schedules/:scheduleId',
    middleware,
    setSentryUserMiddleware,
    handler(handleEditScheduleRoute)
  );
  app.put(
    '/schedules/:scheduleId/enable',
    middleware,
    setSentryUserMiddleware,
    handler(handleEnableScheduleRoute)
  );
  app.put(
    '/schedules/:scheduleId/disable',
    middleware,
    setSentryUserMiddleware,
    handler(handleDisableScheduleRoute)
  );
  app.delete(
    '/schedules/:scheduleId',
    middleware,
    setSentryUserMiddleware,
    handler(handleDeleteScheduleRoute)
  );

  // Routes Assets
  app.get('/assets', middleware, setSentryUserMiddleware, handler(handleGetAssetsRoute));
  app.get(
    '/assets/:assetSymbol',
    middleware,
    setSentryUserMiddleware,
    handler(handleGetAssetRoute)
  );
  app.post('/assets', middleware, setSentryUserMiddleware, handler(handleAddAssetRoute));
  app.delete(
    '/assets/:assetSymbol',
    middleware,
    setSentryUserMiddleware,
    handler(handleDeactivateAssetRoute)
  );

  // Routes Portfolios
  app.get('/portfolios', middleware, setSentryUserMiddleware, handler(handleGetPortfoliosRoute));
  app.post('/portfolios', middleware, setSentryUserMiddleware, handler(handleCreatePortfolioRoute));
  app.get(
    '/portfolios/:portfolioId',
    middleware,
    setSentryUserMiddleware,
    handler(handleGetPortfolioRoute)
  );
  app.put(
    '/portfolios/:portfolioId/allocations',
    middleware,
    setSentryUserMiddleware,
    handler(handleUpdateAllocationsRoute)
  );
  app.put(
    '/portfolios/:portfolioId/settings',
    middleware,
    setSentryUserMiddleware,
    handler(handleUpdatePortfolioSettingsRoute)
  );
  app.delete(
    '/portfolios/:portfolioId',
    middleware,
    setSentryUserMiddleware,
    handler(handleDeactivatePortfolioRoute)
  );

  // Routes Pyth (prix)
  app.get('/prices', middleware, setSentryUserMiddleware, handler(handleGetPricesRoute));
  app.get('/prices/:symbol', middleware, setSentryUserMiddleware, handler(handleGetPriceRoute));
  app.get(
    '/prices/:symbol/history',
    middleware,
    setSentryUserMiddleware,
    handler(handleGetPriceHistoryRoute)
  );
  app.get(
    '/prices/:symbol/stats',
    middleware,
    setSentryUserMiddleware,
    handler(handleGetPriceStatsRoute)
  );
  app.get('/pyth/test', middleware, setSentryUserMiddleware, handler(handleTestPythRoute));

  serviceLogger.info(`Routes registered`);
};
