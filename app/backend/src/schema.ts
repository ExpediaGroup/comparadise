import { z } from 'zod';

export const fetchCurrentPageInputSchema = z.object({
  bucket: z.string().min(1),
  hash: z.string().min(1),
  page: z.number()
});
export const updateBaseImagesInputSchema = z.object({
  hash: z.string().min(1),
  bucket: z.string().min(1),
  repo: z.string().min(1),
  owner: z.string().min(1)
});
export const secretsJsonSchema = z.record(
  z.string(),
  z.object({
    githubToken: z.string().min(1),
    githubApiUrl: z.string().optional()
  })
);
export type FetchCurrentPageInput = z.infer<typeof fetchCurrentPageInputSchema>;
export type UpdateBaseImagesInput = z.infer<typeof updateBaseImagesInputSchema>;
export const FILE_NAMES = {
  BASE: 'base',
  DIFF: 'diff',
  NEW: 'new'
} as const;
export const fileNameSchema = z.enum([
  FILE_NAMES.BASE,
  FILE_NAMES.DIFF,
  FILE_NAMES.NEW
]);
