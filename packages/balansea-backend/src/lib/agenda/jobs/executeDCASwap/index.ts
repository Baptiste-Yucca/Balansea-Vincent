import { executeDCASwap } from './executeDCASwap';

import type { JobType, JobParams } from './executeDCASwap';

export const jobName = 'execute-swap';
export const processJob = executeDCASwap;
export type { JobType, JobParams };
