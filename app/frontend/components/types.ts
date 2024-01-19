import { RouterOutput } from '../utils/trpc';

export type Images = RouterOutput['fetchCurrentPage']['images'];
export type Image = Images[number];
