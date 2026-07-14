import { setFailed, warning, info, getInput } from '@actions/core';
import { getOctokit, context } from '@actions/github';
import { exec } from '@actions/exec';
import { glob } from 'glob';
import { Jimp } from 'jimp';
import { unlinkSync, createWriteStream } from 'fs';
import { mkdir, readFile } from 'fs/promises';
import { defaultS3Operations, type S3Operations } from 'shared/s3';
import { hashFile } from './hash';

export type Octokit = ReturnType<typeof getOctokit>;

export interface Dependencies {
  core: {
    setFailed: (message: string | Error) => void;
    warning: (message: string | Error) => void;
    info: (message: string) => void;
  };
  octokit: Octokit;
  exec: typeof exec;
  glob: typeof glob;
  jimp: { read: typeof Jimp.read };
  s3: S3Operations;
  fs: {
    unlinkSync: typeof unlinkSync;
    createWriteStream: typeof createWriteStream;
    mkdir: typeof mkdir;
    readFile: typeof readFile;
  };
  hashFile: typeof hashFile;
  context: {
    runAttempt: number;
    runId: number;
    serverUrl: string;
    repo: { owner: string; repo: string };
    issue: { number: number };
  };
}

export const makeDefaultDeps = (): Dependencies => ({
  core: { setFailed, warning, info },
  octokit: getOctokit(getInput('github-token')),
  exec,
  glob,
  jimp: { read: Jimp.read.bind(Jimp) },
  s3: defaultS3Operations,
  fs: { unlinkSync, createWriteStream, mkdir, readFile },
  hashFile,
  context: {
    runAttempt: context.runAttempt,
    runId: context.runId,
    serverUrl: context.serverUrl,
    repo: context.repo,
    issue: context.issue
  }
});
