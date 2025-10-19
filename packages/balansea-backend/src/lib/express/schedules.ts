import { Response } from 'express';

import { getAppInfo, getPKPInfo, isAppUser } from '@lit-protocol/vincent-app-sdk/jwt';

import { ScheduleIdentitySchema, ScheduleParamsSchema } from './schema';
import { VincentAuthenticatedRequest } from './types';
import * as jobManager from '../agenda/jobs/dcaSwapJobManager';

const { cancelJob, createJob, disableJob, editJob, enableJob, listJobsByEthAddress } = jobManager;

function getDataFromJWT(req: VincentAuthenticatedRequest) {
  if (!isAppUser(req.user.decodedJWT)) {
    throw new Error('Vincent JWT is not an app user');
  }

  const app = getAppInfo(req.user.decodedJWT);
  const pkpInfo = getPKPInfo(req.user.decodedJWT);

  return { app, pkpInfo };
}

export const handleListSchedulesRoute = async (req: VincentAuthenticatedRequest, res: Response) => {
  const {
    pkpInfo: { ethAddress },
  } = getDataFromJWT(req);
  const schedules = await listJobsByEthAddress({ ethAddress });

  res.json({ data: schedules.map((sched) => sched.toJson()), success: true });
};

export const handleCreateScheduleRoute = async (
  req: VincentAuthenticatedRequest,
  res: Response
) => {
  const { app, pkpInfo } = getDataFromJWT(req);

  const scheduleParams = ScheduleParamsSchema.parse({
    ...req.body,
    pkpInfo,
    app: {
      id: app.appId,
      version: app.version,
    },
  });

  const schedule = await createJob(
    { ...scheduleParams },
    { interval: scheduleParams.purchaseIntervalHuman }
  );
  res.status(201).json({ data: schedule.toJson(), success: true });
};

export const handleEditScheduleRoute = async (req: VincentAuthenticatedRequest, res: Response) => {
  const { app, pkpInfo } = getDataFromJWT(req);
  const { scheduleId } = ScheduleIdentitySchema.parse(req.params);

  const scheduleParams = ScheduleParamsSchema.parse({
    ...req.body,
    pkpInfo,
    app: {
      id: app.appId,
      version: app.version,
    },
  });

  const job = await editJob({
    scheduleId,
    data: { ...scheduleParams },
  });
  res.status(201).json({ data: job.toJson(), success: true });
};

export const handleDisableScheduleRoute = async (
  req: VincentAuthenticatedRequest,
  res: Response
) => {
  const {
    pkpInfo: { ethAddress },
  } = getDataFromJWT(req);

  const { scheduleId } = ScheduleIdentitySchema.parse(req.params);

  const job = await disableJob({ ethAddress, scheduleId });
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.json({ data: job.toJson(), success: true });
};

export const handleEnableScheduleRoute = async (
  req: VincentAuthenticatedRequest,
  res: Response
) => {
  const {
    pkpInfo: { ethAddress },
  } = getDataFromJWT(req);
  const { scheduleId } = ScheduleIdentitySchema.parse(req.params);

  const job = await enableJob({ ethAddress, scheduleId });

  res.json({ data: job.toJson(), success: true });
};

export const handleDeleteScheduleRoute = async (
  req: VincentAuthenticatedRequest,
  res: Response
) => {
  const {
    pkpInfo: { ethAddress },
  } = getDataFromJWT(req);
  const { scheduleId } = ScheduleIdentitySchema.parse(req.params);

  await cancelJob({ ethAddress, scheduleId });

  res.json({ success: true });
};
