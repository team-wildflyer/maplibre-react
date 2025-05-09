import { GetResourceResponse } from '@maptiler/sdk'
import { TileProvider, TileProviderOptions, TileProviderRequest } from './TileProvider'

export class CanvasTileProvider<Params = Record<string, any>> extends TileProvider<Params> {

  constructor(
    protocol: string,
    public readonly tileSize: number,
    private readonly config: CanvasTileProviderConfig<Params>,
  ) {
    super(protocol, config)
  }

  protected async load(request: TileProviderRequest<Params>, abort: AbortController): Promise<GetResourceResponse<any>> {
    const canvas = document.createElement('canvas')
    canvas.width = this.tileSize
    canvas.height = this.tileSize

    const context = canvas.getContext('2d')
    if (context == null) {
      throw new Error('Failed to create canvas context')
    }

    await this.config.draw.call(this, context, request, abort)

    const data = await this.canvasToArrayBuffer(canvas)
    return {data}
  }

  private async canvasToArrayBuffer(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob == null) {
          return reject(new Error('Failed to create blob'))
        }
  
        const reader = new FileReader()
        reader.onload = () => {
          resolve(reader.result as ArrayBuffer)
        }
        reader.onerror = () => {
          reject(new Error('Failed to read blob'))
        }
        reader.readAsArrayBuffer(blob)
      })

    })
  }

}


export interface CanvasTileProviderConfig<Params> extends TileProviderOptions {

  draw: (this: CanvasTileProvider<Params>, context: CanvasRenderingContext2D, request: TileProviderRequest<Params>, abort: AbortController) => Promise<void> | void

}