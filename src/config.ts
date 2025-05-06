import * as maptilersdk from '@maptiler/sdk'
import { isFunction, merge } from 'lodash'
import { DeepPartial } from 'ytil'

export interface Config {
  apiKey:         string
  logger:         LoggerInterface
  updateDebounce: number
  layerPrefix:    (type?: 'tile' | 'polygon') => string
}

export interface LoggerInterface {
  log(...args: any[]): void
  error(...args: any[]): void
  warn(...args: any[]): void
  info(...args: any[]): void
  debug(...args: any[]): void
}

const config: Config = {
  apiKey: '',
  logger: console,

  updateDebounce: 16,
  layerPrefix:    type => `maplibre-react-${type}-layer`,
}

export default config

export function configure(cfg: DeepPartial<Config> | ((config: Config) => any)) {
  if (isFunction(cfg)) {
    cfg(config)
  } else {
    merge(config, cfg)
  }

  maptilersdk.config.apiKey = config.apiKey
}