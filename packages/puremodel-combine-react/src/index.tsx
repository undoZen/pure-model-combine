import { createHeadlessContainer, getStateFromModels } from '@pure-model-combine/core'
import { InitializerState, ModelContextValue, Store } from '@pure-model/core'
import { shallowEqual } from 'fast-equals'
import { createContext, FunctionComponent, PropsWithChildren, ReactNode, useContext, useMemo, useRef } from 'react'
import { createTrackedSelector } from 'react-tracked'
import { useSubscription } from 'use-subscription'
export * from 'redux'

interface Model<S=any> {
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
type Actions = Record<string, AnyFn>
type Initializer<S = any> = (...args: any) => {
    store: Store<S>;
    actions: Actions;
}
type IR = Record<string, Initializer>
type CombineData<M extends IR, P, S, A> = {
  models: M
  creator: (props: P, models: CreatorModels<M>, getState: GetState<M>) => {
    selectors: S
    actions: A
  }
}

type GetState<M extends IR> = () => InitializerModelState<M>

export type Creator<M extends IR, S extends Selectors<M> = Selectors<M>, A extends Actions = Actions> =
  (props: any, models: CreatorModels<M>, getState: GetState<M>) => Created<S, A>

type Created<S, A> = {
  selectors: S
  actions: A
}

type CreatorProps<M extends IR, C> = C extends (props: infer P, models?: InitializerModels<M>, getState?: GetState<M>) => Created<Selectors<M>, Actions> ? P : {}
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

type CProps<M extends IR> = {
  models: InitializerModels<M>
  selectors: Selectors<M>
  actions: Actions
}
type CSProps<M extends IR> = CProps<M> & {
  state: InitializerModelState<M>
}
type CreatorActions<M extends IR, C> = C extends (props?: any[], models?: InitializerModels<M>, getState?: GetState<M>) => {
    selectors: Selectors<M>
    actions: infer AA
} ? AA : {}
type CreatorSelectors<M extends IR, C> = C extends (props?: any[], models?: InitializerModels<M>, getState?: GetState<M>) => {
    selectors: infer SS
    actions: Actions
} ? SS : {}
type PProps<M extends IR> = {
  models?: Partial<InitializerModels<M>>
}
type ProviderType<M extends IR, CT extends Creator<M>> = FunctionComponent<PProps<M>&CreatorProps<M, CT>> & {
  useModels: () => InitializerModels<M>
  useActions: () => CreatorActions<M, CT>
  useSelector: () => States<InitializerModels<M>>
  useSelected: () => {
    [K in keyof CreatorSelectors<M, CT>]:CreatorSelectors<M, CT>[K] extends (...args: any[]) => infer R ? R : never
  }
  toComponent: AnyFn
}
type Selector<M extends IR, Selected extends any = InitializerModelState<M>> = (state: InitializerModelState<M>) => Selected
type SelectorReturn<M extends IR, S extends Selector<M>> = ReturnType<S>
type SelectorsReturnType<M extends IR, SS extends Selectors<M>> = {
  [K in keyof SS]: SelectorReturn<M, SS[K]>
}

export const adaptReact = (
  globalModels: Initializer[] = [],
  preloadedStatesList: any[] = [],
  context?: ModelContextValue
) => {
  const { toHeadless } = createHeadlessContainer(globalModels, preloadedStatesList, context)

  const toProvider = <M extends IR>(combineData: CombineData<M, {}, {}, {}>) => {
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
    const Provider:ProviderType<M, CT> = ({ children, models: modelsInited, ...props }: PropsWithChildren<PProps<M>&CreatorProps<M, CT>>) => {
      const rmm: number = useMemoShallowEqual(() => Math.random(), modelsInited)
      const modelsRef = useRef(modelsInited)
      const { models } = useMemo(() => {
        const { models } = toCombine(modelsInited ?? {}, props)
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
