import { GetResourceResponse, RequestParameters } from '@maptiler/sdk'
import { isFunction, range } from 'lodash'
import { TileProvider, TileProviderOptions } from './TileProvider'

export class WorkerTileProvider extends TileProvider {

  constructor(
    protocol: string,
    private readonly entry: string,
    private readonly config: WorkerTileProviderOptions,
  ) {
    super(protocol, config)

    this.workers = range(config.poolSize ?? 1).map(() => {
      const worker = new Worker(this.entry, {type: 'module'})
      worker.addEventListener('message', this.onWorkerMessage)
      worker.addEventListener('messageerror', this.onWorkerMessageError)
      worker.addEventListener('error', this.onWorkerError)
      return worker
    })
  }

  private workers:   Worker[]
  private callbacks: Map<string, RequestCallbacks[]> = new Map()

  private pending:  string[] = []
  private assigned: Map<Worker, string> = new Map()

  private getWorkerAssignedTo(url: string) {
    for (const entry of this.assigned.entries()) {
      if (entry[1] === url) { return entry[0] }
    }
    return null

  }

  // #region Interface

  protected load(params: RequestParameters, abort: AbortController): Promise<GetResourceResponse<any>> {
    return new Promise((resolve, reject) => {
      // Check to see if we already have callbacks for this request. If so, it is either queued or currently
      // being processed. We can just add our callbacks to the existing ones.
      const callbacks = this.callbacks.get(params.url)
      if (callbacks != null) {
        callbacks.push([resolve, reject])
        return
      }
      
      // This is a new request. Add it to the list of pending requests and set up the callbacks.
      this.pending.push(params.url)
      this.callbacks.set(params.url, [[resolve, reject]])

      // Bind the abort signal to the request.
      abort.signal.addEventListener('abort', this.abortRequest.bind(this, params.url))

      // If we have a worker available, assign it to this request.
      this.next()
    })
  }

  private abortRequest(url: string) {
    // Remove callbacks.
    this.callbacks.delete(url)

    // Remove from the pending list of requests.
    this.pending = this.pending.filter(it => it !== url)

    // Abort and unassign any worker if applicable.
    const worker = this.getWorkerAssignedTo(url)
    if (worker == null) { return }

    worker.postMessage({type: 'abort'})
    this.assigned.delete(worker)

    // This may free up a worker, so we can try to process the next request.
    this.next()
  }

  // #endregion

  // #region Other methods

  public broadcastMessage(type: string, payload: any): void
  public broadcastMessage(type: string, payload: () => {payload: any, transfer: Transferable[]}): void
  public broadcastMessage(type: string, arg: any) {
    const getPayload = () => isFunction(arg) ? arg() : {payload: arg, transfer: undefined}

    for (const worker of this.workers) {
      const {payload, transfer} = getPayload()
      worker.postMessage({type, payload}, transfer)
    }
  }

  // #endregion

  // #region Queue management

  private next() {
    if (this.pending.length === 0) { return }
    
    for (const url of this.pending) {
      const worker = this.availableWorker()
      if (worker == null) { break }

      this.assignAndStart(worker, url)
      this.pending = this.pending.filter(it => it[0] !== url)
    }
  }

  private availableWorker() {
    for (const worker of this.workers) {
      if (!this.assigned.has(worker)) {
        return worker
      }
    }

    return null
  }

  private assignAndStart(worker: Worker, url: string) {
    this.assigned.set(worker, url)
    worker.postMessage({
      type:    'draw', 
      payload: url,
    },)
  }

  // #endregion

  // #region Worker events

  private onWorkerMessage = (event: MessageEvent) => {
    const {type, payload} = event.data as {type: string, payload: any}
    switch (type) {
    case 'result':
      return this.handleWorkerResult(event, callbacks => callbacks[0](payload))
    }
  }

  private onWorkerError = (event: ErrorEvent) => {
    const worker = event.currentTarget as Worker
    if (!(worker instanceof Worker)) { return }

    this.recycleWorker(worker)
    this.next()
  }

  private onWorkerMessageError = (event: MessageEvent) => {
    this.handleWorkerResult(event, callbacks => {
      callbacks[1](new Error("Worker message serialization error"))
    })
  }

  private handleWorkerResult(event: {currentTarget: any}, handle: (callbacks: RequestCallbacks) => void) {
    const worker = event.currentTarget as Worker
    if (!(worker instanceof Worker)) { 
      throw new Error("Invalid worker instance")
    }

    try {
      const url = this.assigned.get(worker)
      if (url == null) { return }

      const callbacks = url == null ? null : this.callbacks.get(url)
      if (callbacks == null) {
        // Might have been aborted / recycled in the mean time.
        return
      } 

      handle([
        result => {
          callbacks.forEach(([resolve]) => resolve(result))
        },
        error => {
          callbacks.forEach(([_, reject]) => reject(error))
        },
      ])
    } finally {
      this.recycleWorker(worker)
      this.next()
    }
  }

  private recycleWorker(worker: Worker) {
    const url = this.assigned.get(worker)
    if (url == null) { return }

    this.assigned.delete(worker)
    this.callbacks.delete(url)
  }
  
  // #endregion

}


export interface WorkerTileProviderOptions extends TileProviderOptions {
  poolSize?: number

  init?:   (this: WorkerTileProvider) => Promise<void>
  deinit?: (this: WorkerTileProvider) => Promise<void>
}

type RequestCallbacks = [(response: GetResourceResponse<any>) => void, (error: Error) => void]