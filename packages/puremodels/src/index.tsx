import { createPureModel, InitializerState, Model, ModelContextValue, Store } from '@pure-model/core'
import { shallowEqual } from 'fast-equals'
import mapValues from 'lodash.mapvalues'
import { createContext, PropsWithChildren, ReactNode, useContext, useMemo, useRef } from 'react'
import { createTrackedSelector } from 'react-tracked'
import { useSubscription } from 'use-subscription'

export type ModelState<S extends Model<any>> = S extends Model<infer T> ? T : never
export type States<SS extends Record<string, Model<any>>> = {
  [K in keyof SS]: ModelState<SS[K]>
}
type Initializer<S = any> = (...args: any) => {
    store: Store<S>;
    actions: Actions;
}
type IR = Record<string, Initializer>
export type ModelRecord = Record<string, Model<any>>
export type InitializerModel<I extends Initializer<any>> = Model<InitializerState<I>>
export type InitializerModels<SS extends IR> = {
  [K in keyof SS]: InitializerModel<SS[K]>
}
export type InitializerModelState<SS extends IR> = States<InitializerModels<SS>>
type Selectors<M extends IR> = Record<string, (state: InitializerModelState<M>) => any>
type Selector<M extends IR, Selected extends any = InitializerModelState<M>> = (state: InitializerModelState<M>) => Selected
type SelectorReturn<M extends IR, S extends Selector<M>> = ReturnType<S>
type SelectorsReturnType<M extends IR, SS extends Selectors<M>> = {
  [K in keyof SS]: SelectorReturn<M, SS[K]>
}
type AnyFn = (...args: any[]) => any
type Actions = Record<string, AnyFn>
// type TransVisitor<M extends IR> = (combineData: CombineData<M>) => Combine<M>

function getStateFromModels<SS extends ModelRecord> (models: SS): States<SS> {
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

export function useModelStates<SS extends ModelRecord> (
  models: SS
): States<SS> {
  const modelsRef = useRef(models)
  type Subscription = {
    getCurrentValue: () => States<SS>
    subscribe: (callback: (states: States<SS>) => void) => () => void
  }
  const subsRef = useRef<Subscription>()
  const stateRef = useRef<States<SS>>(getStateFromModels(models))
  console.log('useModelStates', models)
  if (!shallowEqual(models, modelsRef.current) || !subsRef.current) {
    console.log('subscription', models)
    modelsRef.current = models
    subsRef.current = {
      getCurrentValue: () => getStateFromModels(models),
      subscribe: (callback: (states: States<SS>) => void) => {
        console.log('subscribe objk ', Object.keys(models))
        const subscriptions = Object.keys(models).map((key: keyof SS) => {
          console.log('subscribed', models, key)
          return models[key].store.subscribe(() => {
            console.log('subscribe called', models, key, models[key].store.getState())
            stateRef.current = {
              ...stateRef.current,
              [key]: models[key].store.getState()
            }
            callback(stateRef.current)
          })
        })
        return () => {
          console.log('unsubscribed', models)
          subscriptions.forEach(unsubscribe => unsubscribe())
        }
      }
    }
  }
  return useSubscription(subsRef.current)
}

/*
function useModels<SS extends ModelRecord> (
  models: SS
): [States<SS>, () => SS] {
  const modelsRef = useRef(models)
  type Subscription = {
    getCurrentValue: () => States<SS>
    subscribe: (callback: (states: States<SS>) => void) => () => void
  }
  const subsRef = useRef(null as null | Subscription)
  if (!shallowEqual(models, modelsRef.current) || !subsRef.current) {
    console.log(1)
    modelsRef.current = models
    subsRef.current = {
      getCurrentValue: () => getStateFromModels(models),
      subscribe: (callback: (states: States<SS>) => void) => subscribeModels(models, callback)
    }
  }
  const gm = useCallback(function getModels () { return modelsRef.current }, [])
  return [useSubscription(subsRef.current), gm]
}
*/

const EMPTY_SYMBOL = Symbol('EMPTY')
const useMemoShallowEqual = (fn: () => any, compare: any) => {
  const compareRef = useRef()
  const fnResultRef = useRef(EMPTY_SYMBOL)
  if (fnResultRef.current === EMPTY_SYMBOL || !shallowEqual(compare, compareRef.current)) {
    compareRef.current = compare
    fnResultRef.current = fn()
  }
  return fnResultRef.current as ReturnType<typeof fn>
}

/*
const useIsomorphicLayoutEffect =
  // tslint:disable-next-line: strict-type-predicates
  typeof window !== 'undefined' &&
    // tslint:disable-next-line: strict-type-predicates
    typeof window.document !== 'undefined' &&
    // tslint:disable-next-line: deprecation & strict-type-predicates
    typeof window.document.createElement !== 'undefined'
    ? useLayoutEffect
    : useEffect
*/

function isModel<M = any> (model: any): model is M extends Model<any> ? M : never {
  return model && !!model.store && !!model.actions
}

/*
type MLR = {
  <P>(props P): any
}
const memorizeLastResult = (creator: AnyFn) => {
  let lastResult
  return (props) => {
    if (lastResultRef.current === EMPTY_SYMBOL) {
      lastResultRef.current = creator(...args)
    }
    return lastResultRef.current
  }
}
*/

type PProps<M extends IR> = {
  models?: Partial<InitializerModels<M>>
}
function createCache (
  globalModels: Initializer[] = [],
  preloadedStatesList: any[] = [],
  context?: ModelContextValue
) {
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
export const createHeadlessContainer = (
  globalModels: Initializer[] = [],
  preloadedStatesList: any[] = [],
  context?: ModelContextValue
) => {
  const getCachedDep = createCache(globalModels, preloadedStatesList, context)
  const toHeadless = <M extends IR>(combineData: CombineData<M>) => {
    type CT = typeof combineData.creator
    return {
      toCombine: (modelsInited: Partial<InitializerModels<M>>, props: any = {}) => {
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
        const { selectors, actions } = combineData.creator(props, models as unknown as CreatorModels<M>, (): InitializerModelState<M> => getStateFromModels(models)) as {
          selectors: CreatorSelectors<M, CT>
          actions: CreatorActions<M, CT>
        }
        return {
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

type CProps<M extends IR> = {
  models: InitializerModels<M>
  selectors: Selectors<M>
  actions: Actions
}
type CSProps<M extends IR> = CProps<M> & {
  state: InitializerModelState<M>
}
export const adaptReact = (
  globalModels: Initializer[] = [],
  preloadedStatesList: any[] = [],
  context?: ModelContextValue
) => {
  const { toHeadless } = createHeadlessContainer(globalModels, preloadedStatesList, context)

  const toProvider = () => <M extends IR>(combineData: CombineData<M>) => {
    const { toCombine } = toHeadless(combineData)
    const ModelsContext = createContext<CSProps<M> | null>(null)
    function ModelsStatesProvider ({ children, models, selectors, actions }: PropsWithChildren<CProps<M>>) {
      const state = useModelStates(models)
      return (
        <ModelsContext.Provider value={{ models, state, selectors, actions }}>
          {children}
        </ModelsContext.Provider>
      )
    }
    type CT = typeof combineData.creator
    function Provider ({ children, models: modelsInited, ...props }: PropsWithChildren<PProps<M>&CreatorProps<M, CT>>) {
      const rmm: number = useMemoShallowEqual(() => Math.random(), modelsInited)
      const modelsRef = useRef(modelsInited)
      const { models } = useMemo(() => {
        const { models } = toCombine(modelsInited ?? {})
        modelsRef.current = {
          ...modelsRef.current,
          ...models
        }
        return { models }
      }, [rmm])
      const rmp: number = useMemoShallowEqual(() => Math.random(), props)
      const { selectors, actions } = useMemo(() => {
        return toCombine(models, props)
      }, [rmm, rmp])
      const _props = { models, selectors, actions }
      return <ModelsStatesProvider {..._props}>{children}</ModelsStatesProvider>
    }

    const useSelector = (selector: (state: InitializerModelState<M>) => any) => {
      const ctx = useContext(ModelsContext)
      if (!ctx) {
        throw new Error('useSelector must be used within a Provider')
      }
      const state = ctx.state
      return selector(state)
    }
    const useTrackedSelector = createTrackedSelector(useSelector)
    const useSelected = () => {
      const state = useTrackedSelector()
      const selectors = useContext(ModelsContext)!.selectors
      return new Proxy(state as any, {
        get (target, key) {
          const selector = selectors[key as string]
          return typeof selector !== 'function' ? null : selector(target)
        }
      }) as SelectorsReturnType<M, typeof selectors>
    }
    const useModels = () => {
      const ctx = useContext(ModelsContext)
      if (!ctx) {
        throw new Error('useSelector must be used within a Provider')
      }
      return ctx.models
    }
    const useActions = () => {
      const ctx = useContext(ModelsContext)
      if (!ctx) {
        throw new Error('useSelector must be used within a Provider')
      }
      return ctx.actions
    }
    Provider.useSelector = useTrackedSelector
    Provider.useSelected = useSelected
    Provider.useModels = useModels
    Provider.useActions = useActions

    function toComponent (Component: any) {
      const ComponentWrapped = ({ children }: { children: ReactNode }) => {
        const actions = useActions()
        const selected = useSelected()
        return <Component
          actions={actions}
          selected={selected}
          useSelector={useTrackedSelector}
          useModels={useModels}
        >
          {children}
        </Component>
      }
      function ComponentWrappedWithProvider ({ children, models, ...props }: PropsWithChildren<PProps<M> & CreatorProps<M, CT>>) {
        return <Provider models={models} {...props}>
          <ComponentWrapped {...props}>{children}</ComponentWrapped>
        </Provider>
      }
      ComponentWrappedWithProvider.Provider = Provider
      ComponentWrappedWithProvider.useSelector = useTrackedSelector
      ComponentWrappedWithProvider.useSelected = useSelected
      ComponentWrappedWithProvider.useModels = useModels
      ComponentWrappedWithProvider.useActions = useActions
      return ComponentWrappedWithProvider
    }
    Provider.toComponent = toComponent

    return Provider
  }
  return { toProvider }
}
type GetState<M extends IR> = () => InitializerModelState<M>
/*
type Creator<M extends IR, S extends Selectors<M> = {}, A extends Actions = {}, P extends Record<string, any> = {}> = {
(props: P, models: InitializerModels<M>, getState: GetState<M>): {
  selectors: S
  actions: A,
}
}
*/
type Created<M extends IR> = {
    selectors: Selectors<M>
    actions: Actions
  }
type Creator<M extends IR> = {
  <P extends {}>(props: P, models: CreatorModels<M>, getState: GetState<M>): Created<M>
}
type CreatorProps<M extends IR, C> = C extends (props: infer P, models?: InitializerModels<M>, getState?: GetState<M>) => Created<M> ? P : {}
type CreatorSelectors<M extends IR, C> = C extends (props?: any[], models?: InitializerModels<M>, getState?: GetState<M>) => {
    selectors: infer SS
    actions: Actions
} ? SS : {}
type CreatorActions<M extends IR, C> = C extends (props?: any[], models?: InitializerModels<M>, getState?: GetState<M>) => {
    selectors: Selectors<M>
    actions: infer AA
} ? AA : {}
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
// type CreatorFn<M extends IR> = (props: any, models: InitializerModels<M>, getState: GetState<M>) => any
type CombineData<M extends IR> = {
  models: M
  creator: Creator<M>
}
type AnyVisitor<M extends IR> = (combineData: CombineData<M>) => any
type Combine<M extends IR> = <V extends AnyVisitor<M>>(visitor: V) => ReturnType<V>
type CreateCombine = {
  <M extends IR>(modelInitializers: M): Combine<M>
  <M extends IR>(modelInitializers: M, creator: Creator<M>): Combine<M>
}
export const createCombine: CreateCombine = <M extends IR>(
  modelInitializers: M,
  creator?: Creator<M>
) => {
  if (!creator) {
    creator = () => ({
      selectors: {},
      actions: {}
    })
  }
  const combineData = {
    models: modelInitializers,
    creator: creator as Creator<M>
  } as CombineData<M>
  return (visitor: AnyVisitor<M>) => visitor(combineData)
}
