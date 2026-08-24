import { z } from 'zod';

export const minDeckSizeSchema = z.union([z.literal(40), z.literal(60)]);
