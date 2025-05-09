import { GetResourceResponse } from '@maptiler/sdk'
import { TileProvider, TileProviderOptions, TileProviderRequest } from './TileProvider'

export class CustomTileProvider<Params = Record<string, any>> extends TileProvider<Params> {

  constructor(
    protocol: string,
    private readonly config: CustomTileProviderConfig<Params>,
  ) {
    super(protocol, config)
  }

  protected async load(request: TileProviderRequest<Params>, abort: AbortController): Promise<GetResourceResponse<any>> {
    return this.config.load.call(this, request, abort)
  }

}


export interface CustomTileProviderConfig<Params> extends TileProviderOptions {

  load: (this: CustomTileProvider<Params>, request: TileProviderRequest<Params>, abort: AbortController) => Promise<GetResourceResponse<any>>

}