import { z } from 'zod';
import { ImageName } from "shared";

export const getGroupedImagesInputSchema = z.object({
  hash: z.string().min(1),
  bucket: z.string().min(1)
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
export type GetGroupedImagesInput = z.infer<typeof getGroupedImagesInputSchema>;
export type UpdateBaseImagesInput = z.infer<typeof updateBaseImagesInputSchema>;
export type UpdateCommitStatusInput = z.infer<typeof updateCommitStatusInputSchema>;
export const imageNameSchema = z.nativeEnum(ImageName)
