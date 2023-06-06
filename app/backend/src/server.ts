import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import * as path from 'path';
import * as trpcExpress from '@trpc/server/adapters/express';
import { initTRPC } from '@trpc/server';
import { updateCommitStatus } from './updateCommitStatus';
import { getGroupedImages } from './getGroupedImages';
import { updateBaseImagesInS3 } from './updateBaseImagesInS3';
import { getGroupedImagesInputSchema, updateBaseImagesInputSchema, updateCommitStatusInputSchema } from './schema';

const t = initTRPC.create();

const router = t.router({
  getGroupedImages: t.procedure.input(getGroupedImagesInputSchema).query(({ input }) => getGroupedImages(input)),
  updateBaseImages: t.procedure.input(updateBaseImagesInputSchema).mutation(({ input }) => updateBaseImagesInS3(input)),
  updateCommitStatus: t.procedure.input(updateCommitStatusInputSchema).mutation(({ input }) => updateCommitStatus(input))
});

export type AppRouter = typeof router;

const app = express();

const oneMinute = 60 * 1000;
app.use(rateLimit({ windowMs: oneMinute, max: 1000 }));
app.use(cors());
app.use('/trpc', trpcExpress.createExpressMiddleware({ router }));

app.use(express.static(path.resolve(__dirname, '../../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../../frontend/dist', 'index.html'));
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
