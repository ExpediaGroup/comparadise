import { z } from 'zod';

export const getImagesInputSchema = z.object({
  bucket: z.string().min(1),
  hash: z.string().min(1),
  cursor: z.number()
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
export type GetImagesInput = z.infer<typeof getImagesInputSchema>;
export type UpdateBaseImagesInput = z.infer<typeof updateBaseImagesInputSchema>;
export type UpdateCommitStatusInput = z.infer<typeof updateCommitStatusInputSchema>;
