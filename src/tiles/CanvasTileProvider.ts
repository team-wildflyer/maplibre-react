import { RequestParameters } from '@maptiler/sdk'
import { TileProvider, TileProviderOptions } from './TileProvider'

export class CanvasTileProvider extends TileProvider {

  constructor(
    protocol: string,
    private readonly width: number,
    private readonly height: number,
    private readonly draw: (context: OffscreenCanvasRenderingContext2D, params: RequestParameters, canvas: OffscreenCanvas) => void | Promise<void>,
    options: CanvasTileProviderOptions = {},
  ) {
    super(protocol, options)
  }

  // #region Interface

  protected async load(params: RequestParameters, abort: AbortController) {
    const canvas = new OffscreenCanvas(this.width, this.height)
    const context = canvas.getContext('2d')
    if (context == null) {
      throw new Error('Failed to get 2D context from OffscreenCanvas')
    } 

    await this.draw(context, params, canvas)
    if (abort.signal.aborted) { return null }

    const blob = await canvas.convertToBlob()
    return await blob.arrayBuffer()
  }

  // #endregion

}

export interface CanvasTileProviderOptions extends TileProviderOptions {
}