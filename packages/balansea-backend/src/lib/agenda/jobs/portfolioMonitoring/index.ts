import { portfolioMonitoring } from './portfolioMonitoring';

import type { JobType, JobParams } from './portfolioMonitoring';

export const jobName = 'portfolio-monitoring';
export const processJob = portfolioMonitoring;
export type { JobType, JobParams };
