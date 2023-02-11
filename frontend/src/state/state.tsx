import { makeObservable, observable, reaction, toJS } from 'mobx'
import { getRelation, isKeyAProperty, ManyToOne, Model, OneToMany, property, rIdK } from 'sync-core/src/state'

import { ObjectPool } from './pool'
// import { Block as BlockObject, Space as SpaceObject, User as UserObject } from 'sync-core/src/state/objects'

// ClientModel handles syncing everything already on client except for on receive
// ObjectPool handles syncing everything to server

export class SpaceObject extends Model {
  @property
  title = 'Untitled Space'

  @property
  background = 'black'

  @OneToMany<Block>('space', 'Block')
  blocks: Block[] = []

  @ManyToOne<User>('spaces', 'User')
  user?: User

  @property
  selectedBlocks: Block[] = []
}

class BlockObject extends Model {
  @property
  actionId?: string

  @property
  background = 'white'

  @property
  position: { x: number; y: number } = { x: 0, y: 0 }

  @property
  size: { width: number; height: number } = { width: 2, height: 1 }

  @property
  selected = false

  @ManyToOne<Space>('blocks', 'Space')
  space?: Space

  autorun = false

  inputsUpdated() {
    console.log('inputs updated')
  }
}

class UserObject extends Model {
  @OneToMany<Space>('user', 'Space')
  spaces: Space[] = []

  @property
  username = 'Anonymous'
}

@ClientModel('Space')
export class Space extends SpaceObject {}

@ClientModel('Block')
export class Block extends BlockObject {}
//
@ClientModel('User')
export class User extends UserObject {}

export const clientPool = new ObjectPool()

export function ClientModel<T extends { new (...args: any[]): Model }>(type: string) {
  return function ClientModel<T extends { new (...args: any[]): any }>(target: T) {
    // TODO: add object manager
    console.log('in client model', type, target)
    return class extends target {
      constructor(...args: any[]) {
        if (type === 'Value') {
        }
        super(...args)

        console.log('client model', type, this)

        this.type = type
        this.objectManager = clientPool
        this.objectManager.push(this)
        this.getPersistedState = () => {
          const resp = this.trueState as any
          return resp
        }
        this.getRawState = () => {
          const extraKeysToPersist = ['id', 'type']
          const stateDup = toJS(this)
          for (const key of Object.keys(this)) {
            const relation = getRelation(this, key)
            const isProperty = isKeyAProperty(this, key)
            if (!relation && !isProperty && !extraKeysToPersist.includes(key)) {
              delete stateDup[key]
            }
          }
          return stateDup
        }
        this.persistState = () => {
          this.trueState = this.getRawState()
        }

        this.persistKeys = (keys: string[]) => {
          const stateDup = toJS(this)
          for (const key of keys) {
            this.trueState[key] = stateDup[key]
          }
        }

        this.syncClassesToRelationIds = (idKey: string, key: string, valueId: any, valueType: string) => {
          // console.log(`DB17 reaction to id ${idKey} value`, value)
          if (!Array.isArray(valueId)) {
            if (valueId === '') {
              this[key] = null
            }
            this[key] = this.objectManager.get(valueId, valueType)
          } else {
            this[key] = valueId.map((id) => this.objectManager.get(id, valueType))
            console.log(`this[${key}]`, this[key])
          }
        }

        for (const key of Object.keys(this)) {
          console.log('key', key)
          const relation = getRelation(this, key)
          if (relation) {
            const idKey = rIdK(key)

            if (relation.relationship === 'OneToMany' || relation.relationship === 'ManyToMany') {
              if (relation.relationship === 'ManyToMany') {
                console.log('mtm this[idKey]', this[idKey])
              }
              this[idKey] = this[idKey]?.length > 0 ? this[idKey] : this[key]?.map((obj: any) => obj.id) ?? []
              // console.l
              if (relation.relationship === 'ManyToMany') {
              }
            } else {
              if (idKey === 'id__owner') {
              }
              this[idKey] =
                this[idKey] !== '' && this[idKey] !== null && this[idKey] !== undefined
                  ? this[idKey]
                  : this[key]?.id ?? ''
            }

            const annotations: Record<string, any> = {}
            annotations[idKey] = observable
            annotations[key] = observable
            makeObservable(this, annotations)

            reaction(
              () => toJS(this[idKey]),
              (value) => {
                //
                console.log(`DB17 reaction to id ${idKey} value`, value)
                this.syncClassesToRelationIds(idKey, key, value, relation.type)
              }
            )
          }
          const isProperty = isKeyAProperty(this, key)
          if (isProperty) {
            const annotations: Record<string, any> = {}
            annotations[key] = observable
            makeObservable(this, annotations)
          }
        }

        this.persistState()
      }
    }
  }
}
