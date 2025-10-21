import {
  addProtocol,
  ExpiryData,
  GetResourceResponse,
  removeProtocol,
  RequestParameters,
} from '@maptiler/sdk'
import { Disposable } from 'react-util'
import { bindMethods } from 'ytil'

export abstract class TileProvider extends Disposable {

  constructor(
    public readonly protocol: string,
    public readonly options: TileProviderOptions = {}
  ) {
    super()
    bindMethods(this)
  }

  public install() {
    addProtocol(this.protocol, this.handleLoad)
    return this.uninstall
  }

  public uninstall() {
    removeProtocol(this.protocol)
  }

  private async handleLoad(params: RequestParameters, abort: AbortController): Promise<GetResourceResponse<ArrayBuffer>> {
    const response = await this.load(params, abort)
    return {
      ...response,
      ...this.options.expiry
    }
  }

  protected abstract load(params: RequestParameters, abort: AbortController): Promise<GetResourceResponse<ArrayBuffer>>

}

export type TileProviderRequest<P> = RequestParameters & {params: P, query: URLSearchParams}

export interface TileProviderOptions {
  path?:  string
  expiry?: ExpiryData
}
