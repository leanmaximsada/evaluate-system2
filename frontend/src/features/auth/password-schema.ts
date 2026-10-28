import { z } from 'zod'

export const newPasswordSchema = z
  .string()
  .min(10, 'val.password_min')
  .regex(/[a-z]/, 'val.password_lower')
  .regex(/[A-Z]/, 'val.password_upper')
  .regex(/\d/, 'val.password_number')