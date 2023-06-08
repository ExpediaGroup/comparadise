import { z } from 'zod';

export const getGroupedKeysInputSchema = z.object({
  hash: z.string().min(1),
  bucket: z.string().min(1)
});
export const getImagesInputSchema = z.object({
  bucket: z.string().min(1),
  keys: z.array(z.string().min(1))
});
export const updateBaseImagesInputSchema = z.object({
  hash: z.string().min(1),
  bucket: z.string().min(1),
  repo: z.string().min(1),
  owner: z.string().min(1),
  baseImagesDirectory: z.string().nullish()
});
export const updateCommitStatusInputSchema = z.object({
  hash: z.string().min(1),
  repo: z.string().min(1),
  owner: z.string().min(1)
});
export type GetGroupedKeysInput = z.infer<typeof getGroupedKeysInputSchema>;
export type GetImagesInput = z.infer<typeof getImagesInputSchema>;
export type UpdateBaseImagesInput = z.infer<typeof updateBaseImagesInputSchema>;
export type UpdateCommitStatusInput = z.infer<typeof updateCommitStatusInputSchema>;
