import { addProtocol, GetResourceResponse } from '@maptiler/sdk'

addProtocol('wf', async (): Promise<GetResourceResponse<any>> => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (context == null) {
    throw new Error('Failed to create canvas context')
  }

  canvas.width = 512
  canvas.height = 512

  context.font = '96px sans-serif'
  context.fillStyle = 'black'

  const text = Math.random() < 0.5 ? '🔥' : '🧑‍🚒'
  const size = context.measureText(text)
  context.fillText(text, 256 - size.width / 2, 256 + size.actualBoundingBoxAscent / 2)

  return new Promise<GetResourceResponse<any>>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob == null) {
        return reject(new Error('Failed to create blob'))
      }

      const reader = new FileReader()
      reader.onload = () => {
        const data = reader.result as ArrayBuffer
        resolve({
          data,
        })
      }
      reader.readAsArrayBuffer(blob)
    })

  })
})
