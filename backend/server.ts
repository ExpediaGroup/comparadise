import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import * as path from 'path';
import * as trpcExpress from '@trpc/server/adapters/express';
import { initTRPC } from '@trpc/server';
import { updateCommitStatus } from './updateCommitStatus';
import { getGroupedImages } from './getGroupedImages';
import { updateBaseImagesInS3 } from './updateBaseImagesInS3';
import { z } from 'zod';
import { BASE_IMAGES_DIRECTORY } from './constants';

const t = initTRPC.create();

const router = t.router({
  getGroupedImages: t.procedure
    .input(
      z.object({
        hash: z.string().min(1),
        bucket: z.string().min(1)
      })
    )
    .query(({ input: { hash, bucket } }) => getGroupedImages(hash, bucket)),

  updateBaseImages: t.procedure
    .input(
      z.object({
        hash: z.string().min(1),
        bucket: z.string().min(1),
        baseImagesDirectory: z.string().nullish()
      })
    )
    .mutation(({ input: { hash, bucket, baseImagesDirectory } }) =>
      updateBaseImagesInS3(hash, bucket, baseImagesDirectory || BASE_IMAGES_DIRECTORY)
    ),

  updateCommitStatus: t.procedure
    .input(
      z.object({
        hash: z.string().min(1),
        repo: z.string().min(1),
        owner: z.string().min(1)
      })
    )
    .mutation(({ input: { hash, repo, owner } }) => updateCommitStatus(owner, repo, hash))
});

export type AppRouter = typeof router;

const app = express();

const oneMinute = 60 * 1000;
app.use(rateLimit({ windowMs: oneMinute, max: 1000 }));
app.use(cors());
app.use('/trpc', trpcExpress.createExpressMiddleware({ router }));

app.use(express.static(path.resolve(__dirname, '../dist')));
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../dist', 'index.html'));
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
