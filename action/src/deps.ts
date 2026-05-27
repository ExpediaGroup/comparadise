import { setFailed, warning, info, getInput } from '@actions/core';
import { getOctokit, context } from '@actions/github';
import { exec } from '@actions/exec';
import { glob } from 'glob';
import { Jimp } from 'jimp';
import { unlinkSync, createWriteStream } from 'fs';
import { mkdir, readFile } from 'fs/promises';
import type { S3Operations } from 'shared/s3';
import * as defaultS3 from 'shared/s3';

export type Octokit = ReturnType<typeof getOctokit>;

export interface Deps {
  core: {
    setFailed: (message: string | Error) => void;
    warning: (message: string | Error) => void;
    info: (message: string) => void;
  };
  octokit: Octokit;
  exec: typeof exec;
  glob: typeof glob;
  jimp: { read: typeof Jimp.read };
  s3: Pick<
    S3Operations,
    | 'listObjects'
    | 'listAllObjects'
    | 'getObject'
    | 'putObject'
    | 'deleteObjects'
    | 'getKeysFromS3'
    | 'updateBaseImages'
  >;
  fs: {
    unlinkSync: typeof unlinkSync;
    createWriteStream: typeof createWriteStream;
    mkdir: typeof mkdir;
    readFile: typeof readFile;
  };
  runAttempt: number;
}

export const makeDefaultDeps = (): Deps => ({
  core: { setFailed, warning, info },
  octokit: getOctokit(getInput('github-token')),
  exec,
  glob,
  jimp: { read: Jimp.read.bind(Jimp) },
  s3: {
    listObjects: defaultS3.listObjects,
    listAllObjects: defaultS3.listAllObjects,
    getObject: defaultS3.getObject,
    putObject: defaultS3.putObject,
    deleteObjects: defaultS3.deleteObjects,
    getKeysFromS3: defaultS3.getKeysFromS3,
    updateBaseImages: defaultS3.updateBaseImages
  },
  fs: { unlinkSync, createWriteStream, mkdir, readFile },
  runAttempt: context.runAttempt
});
