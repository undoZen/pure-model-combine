import { createPureModel, Initializer, InitializerState, Model, ModelContextValue } from '@pure-model/core'
import { shallowEqual } from 'fast-equals'
import mapValues from 'lodash.mapvalues'
import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useRef } from 'react'
import { createTrackedSelector } from 'react-tracked'
import { useSubscription } from 'use-subscription'

export type ModelState<S extends Model<any>> = S extends Model<infer T> ? T : never
export type States<SS extends Record<string, Model<any>>> = {
  [K in keyof SS]: ModelState<SS[K]>
}
type IR = Record<string, Initializer>
export type ModelRecord = Record<string, Model<any>>
export type InitializerModel<I extends Initializer<any>> = Model<InitializerState<I>>
export type InitializerModels<SS extends IR> = {
  [K in keyof SS]: InitializerModel<SS[K]>
}
export type InitializerModelState<SS extends IR> = States<InitializerModels<SS>>
type Selectors<M extends IR> =
  (props: any) => Record<string, (state: InitializerModelState<M>) => any>
type Actions<M extends IR, S = Selectors<M>> =
  (models: InitializerModels<M>, getSelected: (sk: keyof S) => any, props: any) => Record<string, (...args: any[]) => void>
type CombineData<M extends IR> = {
  models: M
  selectors?: Selectors<M>
  actions?: Actions<M>
}
type AnyVisitor<M extends IR> = (combineData: CombineData<M>) => any
type Combine<M extends IR> = <V extends AnyVisitor<M>>(visitor: V) => ReturnType<V>
// type TransVisitor<M extends IR> = (combineData: CombineData<M>) => Combine<M>
type CreateModels = <M extends IR>(modelInitializers: M) => Combine<M>
type CreateModelsSelectors = <M extends IR>(modelInitializers: M, selectors: Selectors<M>) => Combine<M>
// type CreateModelsAction = <M extends IR>(modelInitializers: M, actions: Actions<M>) => Combine<M>
type CreateModelsSelectorsActions = <M extends IR>(modelInitializers: M, selectors: Selectors<M>, actions: Actions<M>) => Combine<M>
type CreateCombine = CreateModels | CreateModelsSelectors | CreateModelsSelectorsActions

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

export const adaptReact = (globalModels: Initializer[], preloadedStatesList: any[], context: ModelContextValue) => {
  const deps = new Map<Initializer, Model>()
  function getCachedDep<I extends Initializer<any>> (initializer: I) {
    if (!globalModels.includes(initializer)) {
      throw new Error(`${initializer.name} is not in globalModels`)
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

  const toProvider = () => <M extends IR>(combineData: CombineData<M>) => {
    const ModelsContext = createContext({ models: {} as InitializerModels<M>, state: {} as InitializerModelState<M> })
    function ModelsStatesProvider ({ children, models }: PropsWithChildren<{ models: InitializerModels<M> }>) {
      const state = useModelStates(models)
      return (
        <ModelsContext.Provider value={{ models, state }}>
          {children}
        </ModelsContext.Provider>
      )
    }
    const { models: modelInitializers } = combineData
    const getSelectors = combineData.selectors || (() => ({}))
    const getActions = combineData.actions || (() => ({}))
    type PProps = {
      models?: Partial<InitializerModels<M>>
      context?: ModelContextValue
      preloadedStates?: Partial<InitializerModelState<M>>
    }
    function Provider ({ children, models, context, preloadedStates }: PropsWithChildren<PProps>) {
      const rmi: number = useMemoShallowEqual(() => Math.random(), modelInitializers)
      const modelsInited = useMemo(() => {
        return mapValues(modelInitializers, (initializer, name) => {
          if (globalModels.includes(initializer)) {
            return undefined
          }
          const modelInited = models?.[name]
          if (isModel(modelInited)) {
            return modelInited as Model
          }
          return createPureModel(initializer, {
            context,
            preloadedState: preloadedStates?.[name]
          })
        })
      }, [rmi]) as InitializerModels<M>
      Object.keys(modelInitializers).forEach((name) => {
        const initializer = modelInitializers[name] as Initializer
        if (!globalModels.includes(initializer)) {
          return
        }
        modelsInited[name as keyof M] = getCachedDep(initializer)
      })
      // console.log('modelsInited', modelsInited)
      // const rmm: number = useMemoShallowEqual(() => Math.random(), modelsInited)
      // const selectors = useCallback((props) => getSelectors(props), [rmm])
      // const getSelected = useCallback((props) => getSelectors(props), [rmm])
      // const actions = useCallback((props) => getActions(modelsInited, props), [rmm])
      return <ModelsStatesProvider models={modelsInited}>{children}</ModelsStatesProvider>
    }

    const useSelector = (selector: (state: InitializerModelState<M>) => any) => {
      const state = useContext(ModelsContext).state
      return selector(state)
    }
    const useTrackedSelector = createTrackedSelector(useSelector)
    const useSelected = (props: any) => {
      const state = useTrackedSelector()
      const rmp: number = useMemoShallowEqual(() => Math.random(), props)
      const selectors = useMemo(() => getSelectors(props), [rmp])
      return new Proxy(state as any, {
        get (target, key) {
          console.log('in proxy', key, target)
          const selector = selectors[key as string]
          return typeof selector !== 'function' ? null : selector(target)
        }
      })
    }
    const useModels = () => {
      const models = useContext(ModelsContext).models
      // console.log('useModels', models)
      return models
    }
    const useActions = (props: any) => {
      const models = useContext(ModelsContext).models
      const rmp: number = useMemoShallowEqual(() => Math.random(), props)
      const selectors = useMemo(() => getSelectors(props), [rmp])
      type SK = keyof typeof selectors
      const rmm: number = useMemoShallowEqual(() => Math.random(), models)
      const getSelected = useCallback((key: SK) =>
        selectors[key as string](getStateFromModels(models)), [rmp, rmm])
      const actions = useMemo(() => getActions(models, getSelected, props), [rmp])
      // console.log('useActions', actions)
      return actions
    }
    Provider.useSelector = useTrackedSelector
    Provider.useSelected = useSelected
    Provider.useModels = useModels
    Provider.useActions = useActions

    function toComponent (Component: any) {
      const ComponentWrapped = ({ children, ...props }: PropsWithChildren<any>) => {
        const actions = useActions(props)
        const selected = useSelected(props)
        return <Component
          actions={actions}
          selected={selected}
          useSelector={useTrackedSelector}
          useModels={useModels}
        >
          {children}
        </Component>
      }
      function ComponentWrappedWithProvider ({ children, ...props }: PropsWithChildren<any>) {
        return <Provider {...props}>
          <ComponentWrapped>{children}</ComponentWrapped>
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

export const createCombine: CreateCombine = <M extends IR>(
  modelInitializers: M,
  selectors?: Selectors<M> | null,
  actions?: Actions<M>
) => {
  const combineData = {
    models: modelInitializers
  } as CombineData<M>
  if (selectors) {
    combineData.selectors = selectors
  }
  if (actions) {
    combineData.actions = actions
  }
  return (visitor: AnyVisitor<M>) => visitor(combineData)
}
