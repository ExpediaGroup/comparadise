import { context } from '@actions/github';
import { octokit } from './octokit';
import { getLatestVisualRegressionStatus } from './get-latest-visual-regression-status';

export async function waitForMergeQueueBaseline(
  baseSha: string,
  bucketName: string,
  intervalMs = 30_000,
  timeoutMs = 30 * 60 * 1000
): Promise<boolean> {
  void bucketName;

  const { data: runs } = await octokit.rest.actions.listWorkflowRunsForRepo({
    event: 'merge_group',
    head_sha: baseSha,
    ...context.repo
  });

  if (!runs.workflow_runs.length) {
    return false;
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getLatestVisualRegressionStatus(baseSha);
    if (status?.state) {
      return status.state === 'pending';
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return false;
}
