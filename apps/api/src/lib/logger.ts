import { env } from '../config.js'

export const loggerConfig =
  env.NODE_ENV === 'development'
    ? { level: 'debug', transport: { target: 'pino-pretty' } }
    : { level: 'info' }
