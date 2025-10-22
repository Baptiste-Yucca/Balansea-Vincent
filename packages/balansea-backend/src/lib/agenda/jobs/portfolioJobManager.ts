import consola from 'consola';
import { Types } from 'mongoose';

import * as portfolioMonitoringJobDef from './portfolioMonitoring';
import { getAgenda } from '../agendaClient';

interface FindPortfolioJobParams {
  portfolioId: string;
  mustExist?: boolean;
}

const logger = consola.withTag('portfolioJobManager');

export async function listPortfolioJobsByEthAddress({ ethAddress }: { ethAddress: string }) {
  const agendaClient = getAgenda();
  logger.log('listing portfolio jobs', { ethAddress });

  return (await agendaClient.jobs({
    name: portfolioMonitoringJobDef.jobName,
    'data.ethAddress': ethAddress,
  })) as portfolioMonitoringJobDef.JobType[];
}

export async function findPortfolioJob({
  portfolioId,
  mustExist,
}: FindPortfolioJobParams): Promise<portfolioMonitoringJobDef.JobType | undefined> {
  const agendaClient = getAgenda();

  const jobs = (await agendaClient.jobs({
    name: portfolioMonitoringJobDef.jobName,
    'data.portfolioId': portfolioId,
  })) as portfolioMonitoringJobDef.JobType[];

  logger.log(`Found ${jobs.length} portfolio jobs for portfolio ${portfolioId}`);
  if (mustExist && !jobs.length) {
    throw new Error(`No portfolio monitoring job found for portfolio ${portfolioId}`);
  }

  return jobs[0];
}

export async function createPortfolioJob(
  data: portfolioMonitoringJobDef.JobParams,
  options: {
    interval?: string;
    schedule?: string;
  } = {}
) {
  const agenda = getAgenda();

  // Create a new job instance
  const job = agenda.create<portfolioMonitoringJobDef.JobParams>(
    portfolioMonitoringJobDef.jobName,
    data
  );

  // Ensure only one monitoring job per portfolio
  job.unique({ 'data.portfolioId': data.portfolioId });

  // Schedule the job based on provided options
  if (options.interval) {
    logger.log(
      `Setting portfolio monitoring interval to ${options.interval} for portfolio ${data.portfolioId}`
    );
    job.repeatEvery(options.interval);
  } else if (options.schedule) {
    logger.log(
      `Scheduling portfolio monitoring at ${options.schedule} for portfolio ${data.portfolioId}`
    );
    job.schedule(options.schedule);
  }

  // Save the job to persist it
  await job.save();
  logger.log(`Created portfolio monitoring job ${job.attrs._id} for portfolio ${data.portfolioId}`);

  return job;
}

export async function cancelPortfolioJob({ portfolioId }: { portfolioId: string }) {
  const agenda = getAgenda();

  logger.log(`Cancelling portfolio monitoring job for portfolio ${portfolioId}`);

  await agenda.cancel({
    name: portfolioMonitoringJobDef.jobName,
    'data.portfolioId': portfolioId,
  });
}
