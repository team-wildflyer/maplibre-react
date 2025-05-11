import { addProtocol, GetResourceResponse, removeProtocol, RequestParameters } from '@maptiler/sdk'
import { isFunction } from 'lodash'
import { bindMethods } from 'ytil'

export abstract class TileProvider {

  constructor(
    public readonly protocol: string,
    public readonly options: TileProviderOptions = {}
  ) {
    bindMethods(this)
  }

  public install() {
    addProtocol(this.protocol, this.handleLoad)
    return this.uninstall
  }

  public uninstall() {
    removeProtocol(this.protocol)
  }

  private async handleLoad(params: RequestParameters, abort: AbortController): Promise<GetResourceResponse<any>> {
    const {cacheControl, expires} = this.options
    const data = await this.load(params, abort)
    
    return {
      data,
      cacheControl: isFunction(cacheControl) ? cacheControl(data) : cacheControl,
      expires:      isFunction(expires) ? expires(data) : expires,
    }
  }

  protected abstract load(params: RequestParameters, abort: AbortController): Promise<any>

}

export type TileProviderRequest<P> = RequestParameters & {params: P, query: URLSearchParams}

export interface TileProviderOptions {
  path?: string

  cacheControl?: string | ((data: any) => string)
  expires?:      string | ((data: any) => string)
}
