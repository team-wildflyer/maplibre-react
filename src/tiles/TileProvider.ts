import {
  addProtocol,
  ExpiryData,
  GetResourceResponse,
  removeProtocol,
  RequestParameters,
  TileJSON,
} from '@maptiler/sdk'
import { Disposable } from 'react-util'
import { bindMethods, isFunction } from 'ytil'

export abstract class TileProvider extends Disposable {

  constructor(
    public readonly protocol: string,
    public readonly options: TileProviderOptions = {},
  ) {
    super()
    bindMethods(this)
  }

  public install() {
    addProtocol(this.protocol, this.protocolLoad)
    return this.uninstall
  }

  public uninstall() {
    removeProtocol(this.protocol)
  }

  private async protocolLoad(params: RequestParameters, abort: AbortController): Promise<GetResourceResponse<Partial<TileJSON> | ArrayBuffer>> {
    switch (params.type) {
    case 'json':
      return {
        data: await this.loadTileJSON(params),
      }
    case 'arrayBuffer': case 'image':
    case undefined:
      return {
        ...await this.renderTile(params, abort),
        ...this.options.expiry,
      }
    default:
      throw new TypeError(`Requested type "${params.type}" is not supported`)
    }
  }

  protected async loadTileJSON(params: RequestParameters): Promise<Partial<TileJSON>> {
    const resolveOption = <T>(opt: T | ((url: string) => T)) => {
      if (isFunction(opt)) {
        return opt(params.url)
      } else {
        return opt
      }
    }

    const format = resolveOption(this.options.format)

    return {
      tilejson: '2.2.0',
      tiles:    [params.url + `/{z}/{x}/{y}.${format}`],
      format,

      attribution: this.attribution(params.url),
      description: this.description(params.url),
      minzoom:     this.minzoom(params.url),
      maxzoom:     this.maxzoom(params.url),
      bounds:      this.bounds(params.url),
      scale:       this.scale(params.url),
      center:      this.center(params.url),
    }
  }

  protected attribution(url: string) {
    return resolveOption(this.options.attribution, url)
  }

  protected description(url: string) {
    return resolveOption(this.options.description, url)
  }

  protected minzoom(url: string) {
    return resolveOption(this.options.minzoom, url) ?? 0
  }

  protected maxzoom(url: string) {
    return resolveOption(this.options.maxzoom, url) ?? 14
  }

  protected bounds(url: string) {
    return resolveOption(this.options.bounds, url)
  }

  protected scale(url: string) {
    return resolveOption(this.options.scale, url)
  }

  protected center(url: string) {
    return resolveOption(this.options.center, url)
  }

  protected format(url: string) {
    return resolveOption(this.options.format, url)
  }


  protected abstract renderTile(params: RequestParameters, abort: AbortController): Promise<GetResourceResponse<ArrayBuffer>>

}

function resolveOption<T>(opt: T | ((url: string) => T), url: string) {
  if (isFunction(opt)) {
    return opt(url)
  } else {
    return opt
  }
}

export type TileProviderRequest<P> = RequestParameters & {params: P, query: URLSearchParams}

export interface TileProviderOptions {
  path?:   string
  expiry?: ExpiryData

  attribution?: string | ((url: string) => string)
  description?: string | ((url: string) => string)

  minzoom?: number | ((url: string) => number)
  maxzoom?: number | ((url: string) => number)
  bounds?:  Bounds | ((url: string) => Bounds)
  center?:  Center | ((url: string) => Center)
  
  scale?:  string | ((url: string) => string)
  format?: string | ((url: string) => string)
}


export type Bounds = [west: number, south: number, east: number, north: number]
export type Center = [lon: number, lat: number, zoom: number]