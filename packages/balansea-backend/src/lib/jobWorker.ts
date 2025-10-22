import * as Sentry from '@sentry/node';
import consola from 'consola';

import { createAgenda, getAgenda } from './agenda/agendaClient';
import { portfolioMonitoringJobDef } from './agenda/jobs';

// Function to create and configure a new agenda instance
export async function startWorker() {
  await createAgenda();

  const agenda = getAgenda();

  // Register portfolio monitoring job
  agenda.define(portfolioMonitoringJobDef.jobName, async (job: portfolioMonitoringJobDef.JobType) =>
    Sentry.withIsolationScope(async (scope) => {
      try {
        await portfolioMonitoringJobDef.processJob(job, scope);
      } catch (err) {
        scope.captureException(err);
        const error = err as Error;

        // Handle fatal errors by disabling the job
        if (
          error?.message?.includes('Not enough balance') ||
          error?.message?.includes('insufficient funds') ||
          error?.message?.includes('gas too low') ||
          error?.message?.includes('out of gas')
        ) {
          consola.log(`Disabling portfolio job due to fatal error: ${error.message}`);
          job.disable();
          await job.save();
          throw new Error(`Portfolio monitoring disabled due to fatal error: ${error.message}`);
        }

        // Other errors just bubble up to the job doc
        throw err;
      } finally {
        Sentry.flush(2000);
      }
    })
  );

  return agenda;
}
