import { addProtocol, removeProtocol, RequestParameters } from '@maptiler/sdk'
import { Disposable } from 'react-util'
import { bindMethods } from 'ytil'
import { TileCache } from './TileCache'

export abstract class TileProvider extends Disposable {

  constructor(
    public readonly protocol: string,
    public readonly options: TileProviderOptions = {}
  ) {
    super()
    bindMethods(this)

    if (this.options.cache !== false) {
      this.cache = new TileCache(1024 * 1024 * 10)
    }
  }

  private cache: TileCache | null = null

  public install() {
    addProtocol(this.protocol, this.handleLoad)
    return this.uninstall
  }

  public uninstall() {
    removeProtocol(this.protocol)
  }

  private async handleLoad(params: RequestParameters, abort: AbortController): Promise<any> {
    const cached = this.cache?.fetch(params)
    if (cached != null) {
      return {data: cached}
    }

    const data = await this.load(params, abort)
    if (data != null) {
      this.cache?.store(params, data)
    }

    return {
      data,
      cacheControl: 'no-cache',
      expires:      new Date(),
    }
  }

  protected abstract load(params: RequestParameters, abort: AbortController): Promise<any>

}

export type TileProviderRequest<P> = RequestParameters & {params: P, query: URLSearchParams}

export interface TileProviderOptions {
  path?:  string
  cache?: boolean
}
