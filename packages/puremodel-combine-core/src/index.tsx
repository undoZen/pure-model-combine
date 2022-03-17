import { createPureModel, InitializerState, ModelContextValue, Store } from '@pure-model/core'
import mapValues from 'lodash.mapvalues'
export * from 'redux'

export interface Model<S=any> {
  store: Store<S>
}
export type ModelRecord = Record<string, Model<any>>
export type ModelState<S extends Model<any>> = S extends Model<infer T> ? T : never
export type States<SS extends Record<string, Model<any>>> = {
  [K in keyof SS]: ModelState<SS[K]>
}
export type InitializerModel<I extends Initializer<any>> = Model<InitializerState<I>>
export type InitializerModels<SS extends IR> = {
  [K in keyof SS]: InitializerModel<SS[K]>
}
export type InitializerModelState<SS extends IR> = States<InitializerModels<SS>>
export type Selectors<M extends IR> = Record<string, (state: InitializerModelState<M>) => any>
type AnyFn = (...args: any[]) => any
export type Actions = Record<string, AnyFn>
export type Initializer<S = any> = (...args: any) => {
    store: Store<S>;
    actions: Actions;
}
type IR = Record<string, Initializer>
type CreateCombine = {
  <M extends IR>(modelInitializers: M): CombineData<M, {}, {}, {}>
  <M extends IR, S extends Selectors<M>, A extends Actions, P extends object = {}>(modelInitializers: M, creator: Creator<M, S, A, P>): CombineData<M, P, S, A>
}
export type CombineData<M extends IR, P extends object, S, A> = {
  models: M
  creator: (props: P, models: CreatorModels<M>, getState: GetState<M>) => {
    selectors: S
    actions: A
  }
}

type GetState<M extends IR> = () => InitializerModelState<M>

export type Creator<M extends IR, S extends Selectors<M> = Selectors<M>, A extends Actions = Actions, P = any> =
  (props: P, models: CreatorModels<M>, getState: GetState<M>) => Created<S, A>

type Created<S, A> = {
  selectors: S
  actions: A
}

// type CreatorProps<M extends IR, C> = C extends Creator<M, Selectors<M>, Actions, infer P> ? P : {}
type InitializerModelActions<I extends Initializer> = I extends (...args: any[]) => {
  store: Store
  actions: infer P
} ? P : never
type CreatorModels<SS extends IR> = {
  [K in keyof SS]: {
    store: InitializerModel<SS[K]>['store']
    actions: InitializerModelActions<SS[K]>
  }
}

export const createCombine: CreateCombine = <M extends IR>(
  modelInitializers: M,
  creator?: Creator<M>
) => {
  if (!creator) {
    creator = (props: any, models: CreatorModels<M>, getState: GetState<M>) => ({
      selectors: {},
      actions: {}
    })
    return {
      models: modelInitializers,
      creator
    }
  }
  return {
    models: modelInitializers,
    creator
  }
}

function createCache (globalModels: Initializer[] = [], preloadedStatesList: any[] = [], context?: ModelContextValue) {
  const deps = new Map<Initializer, Model>()
  return function getCachedDep<I extends Initializer<any>> (initializer: I) {
    if (!globalModels.includes(initializer)) {
      return
    }
    if (!deps.has(initializer)) {
      const index = globalModels.indexOf(initializer)
      const preloadedState = preloadedStatesList[index]
      // console.log('cpm', name, initializer, preloadedState)
      const dep = createPureModel(initializer, {
        context,
        preloadedState
      }) as InitializerModel<I>
      deps.set(initializer, dep)
      return dep
    }
    // console.log('dep cache hit', initializer, dep)
    return deps.get(initializer) as InitializerModel<I>
  }
}
function isModel<M = any> (model: any): model is M extends Model<any> ? M : never {
  return model && !!model.store && !!model.actions
}
export function getStateFromModels<SS extends ModelRecord> (models: SS): States<SS> {
  return Object.keys(models).reduce((acc, key) => {
    acc[key as keyof SS] = models[key].store.getState()
    return acc
  }, {} as States<SS>)
}

export function subscribeModels<SS extends ModelRecord> (models: SS, listener: (models: States<SS>) => void) {
  const cachedState = getStateFromModels(models)
  const subscriptions = Object.keys(models).map((key: keyof SS) => {
    return models[key].store.subscribe(() => {
      listener({
        ...cachedState,
        [key]: models[key].store.getState()
      })
    })
  })
  return () => {
    subscriptions.forEach(unsubscribe => unsubscribe())
  }
}
export const createHeadlessContainer = (
  globalModels: Initializer[] = [],
  preloadedStatesList: any[] = [],
  context?: ModelContextValue
) => {
  const getCachedDep = createCache(globalModels, preloadedStatesList, context)
  const toHeadless = <M extends IR, P extends object, S extends Selectors<M>, A extends Actions>(combineData: CombineData<M, P, S, A>) => {
    return {
      toCombine: (modelsInited: Partial<InitializerModels<M>> = {}, props: P) => {
        const models = mapValues(combineData.models, (initializer, name) => {
          const cached = getCachedDep(initializer)
          if (cached) {
            return cached
          }
          const modelInited = modelsInited?.[name]
          if (isModel(modelInited)) {
            return modelInited as Model
          }
          return createPureModel(initializer, {
            context
          })
        }) as InitializerModels<M>
        const { selectors, actions } = combineData.creator(props, models as unknown as CreatorModels<M>, (): InitializerModelState<M> => getStateFromModels(models))
        const subscribe = (listener: (state: InitializerModelState<M>) => void) =>
          subscribeModels(models, listener)
        const getState = () => getStateFromModels(models)
        return {
          subscribe,
          getState,
          models,
          selectors,
          actions
        }
      }
    }
  }
  return {
    getCachedDep,
    toHeadless
  }
}
