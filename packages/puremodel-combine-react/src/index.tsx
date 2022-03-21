import { Actions, CombineData, createHeadlessContainer, getStateFromModels, Initializer, InitializerModels, InitializerModelState, ModelRecord, Selectors, States } from '@pure-model-combine/core'
import { ModelContextValue } from '@pure-model/core'
import { shallowEqual } from 'fast-equals'
import { ComponentType, createContext, FunctionComponent, PropsWithChildren, useContext, useMemo, useRef } from 'react'
import { createTrackedSelector } from 'react-tracked'
import { useSubscription } from 'use-subscription'
export * from 'redux'

type IR = Record<string, Initializer>

export function useModelsState<SS extends ModelRecord> (
  models: SS
): States<SS> {
  const modelsRef = useRef(models)
  type Subscription = {
    getCurrentValue: () => States<SS>
    subscribe: (callback: (states: States<SS>) => void) => () => void
  }
  const subsRef = useRef<Subscription>()
  const stateRef = useRef<States<SS>>(getStateFromModels(models))
  // console.log('useModelsState', models)
  if (!shallowEqual(models, modelsRef.current) || !subsRef.current) {
    // console.log('subscription', models)
    modelsRef.current = models
    subsRef.current = {
      getCurrentValue: () => getStateFromModels(models),
      subscribe: (callback: (states: States<SS>) => void) => {
        const subscriptions = Object.keys(models).map((key: keyof SS) => {
          return models[key].store.subscribe(() => {
            // console.log('listener called', models, key, models[key].store.getState())
            stateRef.current = {
              ...stateRef.current,
              [key]: models[key].store.getState()
            }
            callback(stateRef.current)
          })
        })
        return () => {
          subscriptions.forEach(unsubscribe => unsubscribe())
          // console.log('unsubscribed', models)
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

type ModelProviderProps<M extends IR, S extends Selectors<M>, A extends Actions> = {
  models: InitializerModels<M>
  selectors: S
  actions: A
}
type ModelContextProviderProps<M extends IR, S extends Selectors<M>, A extends Actions> = ModelProviderProps<M, S, A> & {
  state: InitializerModelState<M>
}
type ProviderProps<M extends IR> = {
  models?: Partial<InitializerModels<M>>
}
type Helplers<M extends IR, S extends Selectors<M>, A extends Actions> = {
  useModels: () => InitializerModels<M>
  useActions: () => A
  useSelector: () => States<InitializerModels<M>>
  useSelected: () => {
    [K in keyof S]: ReturnType<S[K]>
  }
}
type ComponentProps<M extends IR, S extends Selectors<M>, A extends Actions> = {
  useModels: () => InitializerModels<M>
  useSelector: () => States<InitializerModels<M>>
  selected: SelectorsReturnType<M, S>
  actions: A
}
type ComponentHOC<M extends IR, P, S extends Selectors<M>, A extends Actions> = {
  (component: ComponentType<ComponentProps<M, S, A> & P>):
    FunctionComponent<ProviderProps<M> & P> & Helplers<M, S, A> & { Provider: ProviderType<M, P, S, A>}
}
type ProviderType<M extends IR, P, S extends Selectors<M>, A extends Actions> =
  FunctionComponent<ProviderProps<M> & P> &
  Helplers<M, S, A> & {
    toComponent: ComponentHOC<M, P, S, A>
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

  const createReactContainer = <M extends IR, P extends object, S extends Selectors<M>, A extends Actions>(combineData: CombineData<M, P, S, A>) => {
    const { toCombine } = toHeadless(combineData)
    const ModelsContext = createContext<ModelContextProviderProps<M, S, A> | null>(null)
    function ModelsStatesProvider ({ children, models, selectors, actions }: PropsWithChildren<ModelProviderProps<M, S, A>>) {
      const state = useModelsState(models)
      return (
        <ModelsContext.Provider value={{ models, state, selectors, actions }}>
          {children}
        </ModelsContext.Provider>
      )
    }

    const Provider:ProviderType<M, P, S, A> = ({ children, models: modelsInited, ...props }: PropsWithChildren<ProviderProps<M> & P>) => {
      const rmm: number = useMemoShallowEqual(() => Math.random(), modelsInited)
      const modelsRef = useRef(modelsInited)
      const { models } = useMemo(() => {
        const { models } = toCombine(modelsInited ?? {}, props as P)
        modelsRef.current = {
          ...modelsRef.current,
          ...models
        }
        return { models }
      }, [rmm])
      const rmp: number = useMemoShallowEqual(() => Math.random(), props)
      const { selectors, actions } = useMemo(() => {
        return toCombine(models, props as P)
      }, [rmm, rmp])
      // selectors actions 可以随 props 变化，models 一般只需初始化一次，所以分开调用两次 toCombine()
      return <ModelsStatesProvider models={models} selectors={selectors} actions={actions} >
        {children}
      </ModelsStatesProvider>
    }

    const useContextModelsState = (selector: (state: InitializerModelState<M>) => any) => {
      const ctx = useContext(ModelsContext)
      if (!ctx) {
        throw new Error('useSelector must be used within a Provider')
      }
      const state = ctx.state
      return selector(state)
    }
    const useSelector = createTrackedSelector(useContextModelsState)
    const useSelected = () => {
      const state = useSelector()
      const selectors = useContext(ModelsContext)?.selectors
      return new Proxy(state as any, {
        get (target, key) {
          const selector = selectors?.[key as string]
          return typeof selector !== 'function' ? null : selector(target)
        }
      }) as SelectorsReturnType<M, S>
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
    Provider.useSelector = useSelector
    Provider.useSelected = useSelected
    Provider.useModels = useModels
    Provider.useActions = useActions

    const toComponent: ComponentHOC<M, P, S, A> = (Component) => {
      const ComponentWrapped = (props: PropsWithChildren<P>) => {
        const actions = useActions()
        const selected = useSelected()
        return <Component
          actions={actions}
          selected={selected}
          useSelector={useSelector}
          useModels={useModels}
          {...props}
        />
      }
      const ComponentWrappedWithProvider = (props: PropsWithChildren<ProviderProps<M> & P>) => {
        const { children, ...rest } = props
        return <Provider {...(rest as ProviderProps<M> & P)}>
          <ComponentWrapped {...props} />
        </Provider>
      }
      ComponentWrappedWithProvider.Provider = Provider
      ComponentWrappedWithProvider.useSelector = useSelector
      ComponentWrappedWithProvider.useSelected = useSelected
      ComponentWrappedWithProvider.useModels = useModels
      ComponentWrappedWithProvider.useActions = useActions
      return ComponentWrappedWithProvider
    }
    Provider.toComponent = toComponent

    return Provider
  }
  return { createReactContainer }
}
