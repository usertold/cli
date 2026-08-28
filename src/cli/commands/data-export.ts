import { writeFile } from 'node:fs/promises';
import type { ParsedArgs } from '../lib/types';
import {
  assertNoExtraPositionals,
  getBooleanOption,
  hasHelpFlag,
  parseEnvironment,
  requirePositional,
} from '../lib/args';
import { requestContract, requestContractBinary } from '../lib/contract-api';
import { fail } from '../lib/errors';
import { isJsonOutput, printOutput } from '../lib/output';
import type { DashboardApiResponse } from '../../shared/api-contracts';
import { printCommandHelp } from './help-manifest';


type ExportJob = DashboardApiResponse<'dataExportGet'>['job'];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForExport(env: ReturnType<typeof parseEnvironment>, jobId: string): Promise<ExportJob> {
  for (;;) {
    const result = await requestContract({ env, key: 'dataExportGet', pathParams: { jobId } });
    if (result.job.status === 'completed' || result.job.status === 'failed') {
      return result.job;
    }
    await sleep(5000);
  }
}

async function downloadExport(env: ReturnType<typeof parseEnvironment>, jobId: string, outputPath?: string): Promise<string> {
  const data = await requestContractBinary('dataExportDownload', {
    env,
    pathParams: { jobId },
  });
  const target = outputPath ?? `usertold-data-export-${jobId}.json`;
  await writeFile(target, data);
  return target;
}

function printJob(job: ExportJob): void {
  console.log(`${job.id}  ${job.status}  requested ${job.requested_at}  expires ${job.expires_at}`);
  if (job.download_url) {
    console.log(`Download: usertold export download ${job.id}`);
  }
  if (job.error_message) {
    console.log(`Error: ${job.error_message}`);
  }
}

export async function handleDataExportCommand(subcommand: string | undefined, parsed: ParsedArgs): Promise<void> {
  if (!subcommand || hasHelpFlag(parsed) || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    printCommandHelp('export');
    return;
  }

  const env = parseEnvironment(parsed);

  switch (subcommand) {
    case 'start': {
      assertNoExtraPositionals(parsed, 0);
      const result = await requestContract({ env, key: 'dataExportCreate' });

      if (getBooleanOption(parsed, 'wait')) {
        const completed = await waitForExport(env, result.job.id);
        if (completed.status === 'failed') {
          fail(completed.error_message ?? 'Data export failed');
        }
        if (parsed.options.output && parsed.options.output !== 'true') {
          const target = await downloadExport(env, completed.id, parsed.options.output);
          if (isJsonOutput(parsed)) {
            printOutput({ job: completed, output: target }, parsed, { remapVocab: false });
          } else {
            console.log(`Downloaded ${target}`);
          }
          return;
        }
        printOutput({ job: completed, media_url_ttl_seconds: result.media_url_ttl_seconds }, parsed, { remapVocab: false });
        return;
      }

      printOutput(result, parsed, { remapVocab: false });
      return;
    }

    case 'list': {
      assertNoExtraPositionals(parsed, 0);
      const result = await requestContract({ env, key: 'dataExportList' });
      printOutput(result, parsed, { remapVocab: false });
      return;
    }

    case 'status': {
      const jobId = requirePositional(parsed, 0, 'exportJobId');
      assertNoExtraPositionals(parsed, 1);
      const result = await requestContract({ env, key: 'dataExportGet', pathParams: { jobId } });
      if (isJsonOutput(parsed)) {
        printOutput(result, parsed, { remapVocab: false });
      } else {
        printJob(result.job);
      }
      return;
    }

    case 'download': {
      const jobId = requirePositional(parsed, 0, 'exportJobId');
      assertNoExtraPositionals(parsed, 1);
      const target = await downloadExport(
        env,
        jobId,
        parsed.options.output && parsed.options.output !== 'true' ? parsed.options.output : undefined,
      );
      if (isJsonOutput(parsed)) {
        printOutput({ job_id: jobId, output: target }, parsed, { remapVocab: false });
      } else {
        console.log(`Downloaded ${target}`);
      }
      return;
    }

    default:
      fail(`Unknown export command: ${subcommand}`);
  }
}
