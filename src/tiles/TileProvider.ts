import { addProtocol, GetResourceResponse, removeProtocol, RequestParameters } from '@maptiler/sdk'
import { bindMethods } from 'ytil'
import { TileCache } from './TileCache'

export abstract class TileProvider {

  constructor(
    public readonly protocol: string,
    public readonly options: TileProviderOptions = {}
  ) {
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

  private async handleLoad(params: RequestParameters, abort: AbortController): Promise<GetResourceResponse<any>> {
    const cached = this.cache?.fetch(params)
    if (cached != null) { return {data: cached} }

    const data = await this.load(params, abort)
    if (data != null) {
      this.cache?.store(params, data)
    }

    return {data}
  }

  protected abstract load(params: RequestParameters, abort: AbortController): Promise<any>

}

export type TileProviderRequest<P> = RequestParameters & {params: P, query: URLSearchParams}

export interface TileProviderOptions {
  path?:  string
  cache?: boolean
}
