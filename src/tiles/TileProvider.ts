import { addProtocol, GetResourceResponse, removeProtocol, RequestParameters } from '@maptiler/sdk'
import { pathToRegexp } from 'path-to-regexp'
import { bindMethods } from 'ytil'

export abstract class TileProvider<Params = Record<string, any>> {

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

  private async handleLoad(request: RequestParameters, abort: AbortController): Promise<GetResourceResponse<any>> {
    const params = this.buildPathParams(request)
    const query = new URL(request.url).searchParams

    return this.load({...request, params, query}, abort)
  }

  private buildPathParams(request: RequestParameters): Params {
    const {path: pattern} = this.options
    if (pattern == null) { return {} as Params }

    const {regexp, keys} = pathToRegexp(pattern)

    // Don't use any URL parsing, as a custom protocol might indicate some completely different URI scheme.
    // Just remove the protocol prefix and the colon, and let the pattern match the rest.
    const url = new URL(request.url)
    const path = url.pathname.replace(/^\//, '')
    const match = regexp.exec(path)
    if (match == null) {
      throw new Error(`Failed to match path "${path}" with pattern "${pattern}"`)
    }

    const params: Record<string, any> = {}
    for (const [index, key] of keys.entries()) {
      if (key.type === 'param') {
        params[key.name] = match[index + 1]
      } else {
        params[key.name] = match.indices != null
          ? path.slice(match.indices[index + 1][0])
          : match.slice(index + 1).join('/')
        break
      }
    }

    return params as Params
  }

  protected abstract load(params: TileProviderRequest<Params>, abort: AbortController): Promise<GetResourceResponse<any>>

}

export type TileProviderRequest<P> = RequestParameters & {params: P, query: URLSearchParams}

export interface TileProviderOptions {
  path?: string
}
