import { addProtocol, removeProtocol, RequestParameters } from '@maptiler/sdk'
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

  private async handleLoad(params: RequestParameters, abort: AbortController): Promise<any> {
    const {buffer: data, url} = await this.load(params, abort)
    if (url !== params.url) {
      console.warn(`Loaded URL does not match requested URL: requested=${params.url}, loaded=${url}`)
      throw new Error("Loaded URL does not match requested URL")
    }
    if (abort.signal.aborted) {
      throw new Error("Request aborted")
    }
    return {data}
  }

  protected abstract load(params: RequestParameters, abort: AbortController): Promise<{buffer: any, url: string}>

}

export type TileProviderRequest<P> = RequestParameters & {params: P, query: URLSearchParams}

export interface TileProviderOptions {
  path?:  string
  cache?: boolean
}
