import { makeAutoObservable, observable } from 'mobx'
import {
  Model,
  ModelToClientApplyTxRequest,
  ObjectManager,
  rIdK,
  TX,
  WebsocketMessage,
  WebsocketPullRequestMessage,
} from 'sync-core/src/state'

import { Block, Space, User } from './state'

const websocketUri = 'ws://127.0.0.1:8787/ws'

interface RequestedPull {
  type: string
  id: string
  timestamp: number
}

export class ObjectPool implements ObjectManager {
  @observable
  public objects: Model[]

  private ws?: WebSocket
  private connecting?: boolean
  private recentFailures = 0
  private readonly beforeUnload: (event: BeforeUnloadEvent) => void
  private readonly tryConnectId: number
  private readonly resetFailuresId: number

  private requestedPulls = new Map<string, RequestedPull>()
  private knownTXs: string[] = []

  apply(tx: TX) {
    if (this.knownTXs.includes(tx.id)) {
      return
    }
    this.knownTXs.push(tx.id)
    for (const mutation of tx.forwards) {
      const { onClass, onClassId } = mutation
      const object = this.objects.find((o) => o.id === onClassId && o.type === onClass)

      if (!object) {
        console.warn('requesting pull of for tx', onClass, onClassId, tx)
        this.requestPullIfNeeded(onClass, onClassId)
        continue
      }
      console.log(`[client pool] apply onClass: '${object.type}'`, object)
      object.applyTX(tx)
    }
    const msg: WebsocketMessage = {
      type: 'tx',
      from: 'client',
      tx,
    }
    this.websocketOperationWithRetry(async () => {
      this.ws?.send(JSON.stringify(msg))
    })
  }

  websocketOperationWithRetry<T>(operation: () => Promise<T>, retries = 5): Promise<T> {
    return new Promise((resolve, reject) => {
      const tryOperation = () => {
        const attempt = async () => {
          if (!this.ws) {
            throw new Error('No websocket connection')
          }
          const res = await operation()
          return res
        }
        attempt()
          .then((result) => resolve(result))
          .catch((err) => {
            if (retries > 0) {
              setTimeout(tryOperation, retries * 10)
            } else {
              reject(err)
            }
          })
      }
      tryOperation()
    })
  }

  get(id: string, classType: string) {
    const res = this.objects.find((o) => o.id === id && o.type === classType)
    return res
  }

  push(object: Model) {
    if (!this.get(object.id, object.type)) {
      this.objects.push(object)
    } else {
      console.warn('tried to add duplicate to client pool:', object.id, object.type)
    }
  }

  requestPullIfNeeded(classType: string, classId: string) {
    // TODO: queue to prevent dups

    if (this.requestedPulls.has(classId)) {
      const requestedPull = this.requestedPulls.get(classId)
      if (requestedPull && requestedPull.type === classType && requestedPull.timestamp > Date.now() - 10000) {
        return
      }
    }
    const run = async () => {
      const index = this.objects.findIndex((o) => o.id === classId && o.type === classType)
      if (index === -1) {
        const msg: WebsocketPullRequestMessage = {
          type: 'pullRequest',
          classType,
          classId,
        }
        this.websocketOperationWithRetry(async () => {
          this.ws?.send(JSON.stringify(msg))
        })
      }
    }

    this.requestedPulls.set(classId, {
      type: classType,
      id: classId,
      timestamp: Date.now(),
    })

    run()
  }

  constructor() {
    makeAutoObservable(this)
    this.objects = []

    this.beforeUnload = (event: BeforeUnloadEvent) => {
      //
    }
    window.addEventListener('beforeunload', this.beforeUnload)
    const interval = 1000
    this.tryConnect()
    this.tryConnectId = window.setInterval(() => this.tryConnect(), interval)
    this.resetFailuresId = window.setInterval(() => (this.recentFailures = 0), 15 * interval)
  }

  dispose() {
    window.clearInterval(this.tryConnectId)
    window.clearInterval(this.resetFailuresId)
    window.removeEventListener('beforeunload', this.beforeUnload)
    this.ws?.close()
  }

  private tryConnect() {
    if (this.connecting || this.ws) return
    this.connecting = true
    const ws = new WebSocket(websocketUri)
    ws.onopen = () => {
      this.connecting = false
      this.ws = ws
    }
    ws.onclose = () => {
      if (this.ws) {
        this.ws = undefined
        // this.options.onDisconnected?.()
        if (++this.recentFailures >= 5) {
          // If we disconnect 5 times within 15 reconnection intervals, then the
          // client is likely desynchronized and needs to refresh.
          this.dispose()
          // this.options.onDesynchronized?.()
        }
      } else {
        this.connecting = false
      }
    }
    ws.onmessage = ({ data }) => {
      if (typeof data === 'string') {
        this.handleMessage(JSON.parse(data))
      }
    }
  }

  // TODO:
  public async awaitObject<T extends Model>(classType: string, classId: string): Promise<T | undefined> {
    this.requestPullIfNeeded(classType, classId)
    return new Promise((resolve, reject) => {
      const run = async (attempts: number) => {
        const object = this.get(classId, classType)
        if (object) {
          resolve(object as T)
        } else {
          if (attempts > 0) {
            setTimeout(() => run(attempts - 1), 300)
          } else {
            resolve(undefined)
          }
        }
      }
      run(5)
    })
  }

  private handleMessage(msg: WebsocketMessage | ModelToClientApplyTxRequest) {
    switch (msg.type) {
      case 'req:client-apply-tx':
        const fromModelMsg = msg as any as ModelToClientApplyTxRequest
        const tx = JSON.parse(fromModelMsg.payload) as TX
        this.apply(tx)
        break
      case 'pullResponse':
        const obj = JSON.parse(msg.object)
        const existing = this.objects.find((o) => o.id === obj.id && o.type === obj.type)
        if (existing) {
          // TODO:ensure no duplicate objects
          this.objects = this.objects.filter((o) => o.id !== obj.id)
        }
        {
          let object: any
          switch (obj.type) {
            case 'Space':
              console.log('got space', obj)
              object = Space.fromJSON(obj)
              this.push(object)
              break
            case 'Block':
              console.log('got block', obj)
              object = Block.fromJSON(obj)
              this.push(object)
              break
            case 'User':
              console.log('got user', obj)
              object = User.fromJSON(obj)
              this.push(object)
              break

            default:
              throw new Error('Unknown class type')
          }

          // TODO: maybe(?) – move to ClientModel
          for (const key of Object.keys(object)) {
            const relation = object.getRelation(key)
            if (!relation) continue
            if (relation) {
              const idKey = rIdK(key)
              const idValue = object[idKey]
              if (!idValue || idValue === '' || (idValue as any[]).length === 0) continue
              if (relation.relationship === 'ManyToOne') {
                // for (let id of idValue) {
                const referencedObject = this.get(idValue, relation.type)
                if (!referencedObject) {
                  this.requestPullIfNeeded(relation.type, idValue)
                  continue
                }
                if (!(referencedObject as any)[relation.property].find((o: any) => o && o.id === object.id)) {
                  ;(referencedObject as any)[relation.property].push(object)
                }
                ;(object as any)[key] = referencedObject
              }

              if (relation.relationship === 'OneToMany') {
                for (const id of idValue) {
                  const referencedObject = this.get(id, relation.type)
                  if (!referencedObject) {
                    console.warn(`[CLIENTPOOL] Received pull for missing object: ${relation.type} ${id}`)
                    this.requestPullIfNeeded(relation.type, id)
                    continue
                  }
                  if ((referencedObject as any)[relation.property] !== object) {
                    ;(referencedObject as any)[relation.property] = object
                  }
                  ;(object as any)[key].push(referencedObject)
                }
              }

              if (relation.relationship === 'OneToOne') {
                const referencedObject = this.get(idValue, relation.type)
                if (!referencedObject) {
                  console.warn(`[CLIENTPOOL] Received pull for missing object: ${relation.type} ${idValue}`)
                  this.requestPullIfNeeded(relation.type, idValue)
                  continue
                }
                if ((referencedObject as any)[relation.property] !== object) {
                  ;(referencedObject as any)[relation.property] = object
                }
                ;(object as any)[key] = referencedObject
              }

              if (relation.relationship === 'ManyToMany') {
                // console("Applytin")
                for (const id of idValue) {
                  const referencedObject = this.get(id, relation.type)
                  if (!referencedObject) {
                    console.warn(`[CLIENTPOOL] Received pull for missing object: ${relation.type} ${id}`)
                    this.requestPullIfNeeded(relation.type, id)
                    continue
                  }
                  if (!(referencedObject as any)[relation.property].find((o: any) => o && o.id === object.id)) {
                    ;(referencedObject as any)[relation.property].push(object)
                  }
                  if (!(object as any)[key].find((o: any) => o && o.id === referencedObject.id)) {
                    ;(object as any)[key].push(referencedObject)
                  }
                }
              }
            }
          }
          object.persistState()

          break
        }
      default:
        throw new Error('Unknown message type')
    }
  }
}
