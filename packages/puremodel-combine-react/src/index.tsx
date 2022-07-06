import { Actions, adaptHeadless, CombineData, getStateFromModels, Initializer, InitializerModels, InitializerModelState, ModelRecord, Selectors, States } from '@pure-model-combine/core'
import { ModelContextValue } from '@pure-model/core'
import { shallowEqual } from 'fast-equals'
import { ComponentType, createContext, FunctionComponent, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react'
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
      getCurrentValue: () => stateRef.current,
      subscribe: (callback: (states: States<SS>) => void) => {
        const currentState = getStateFromModels(models)
        if (!shallowEqual(currentState, stateRef.current)) {
          stateRef.current = currentState
          // console.log('state changed', currentState)
        }
        const subscriptions = Object.keys(models).map((key: keyof SS) => {
          return models[key].store.subscribe(() => {
            const newState = models[key].store.getState()
            // console.log('model', key, 'updated: ', newState, stateRef.current?.[key], stateRef.current?.[key] !== newState)
            if (stateRef.current?.[key] !== newState) {
              stateRef.current = {
                ...stateRef.current,
                [key]: newState
              }
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

type ModelSubscriberProps<M extends IR> = {
  models: InitializerModels<M>
  updateState: (s: InitializerModelState<M>) => void
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
    FunctionComponent<ProviderProps<M> & P>
}
type ProviderType<M extends IR, P> =
  FunctionComponent<ProviderProps<M> & P>
type ContainerType<M extends IR, P, S extends Selectors<M>, A extends Actions> =
  Helplers<M, S, A>
  & {
    toWrappedComponent: ComponentHOC<M, P, S, A>
    toComponent: ComponentHOC<M, P, S, A>
  }
  & { Provider: ProviderType<M, P>}
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
  const { createHeadlessContainer } = adaptHeadless(globalModels, preloadedStatesList, context)

  const createReactContainer = <M extends IR, P extends object, S extends Selectors<M>, A extends Actions>(combineData: CombineData<M, P, S, A>) => {
    const { toCombine } = createHeadlessContainer(combineData)
    const ModelsContext = createContext<ModelContextProviderProps<M, S, A> | null>(null)
    function SubscribeModelsState ({ models, updateState }: ModelSubscriberProps<M>) {
      const state = useModelsState(models)
      useEffect(() => { updateState(state) }, [state])
      return null
    }

    const Provider:ProviderType<M, P> = ({ children, models: modelsInited = {}, ...props }: PropsWithChildren<ProviderProps<M> & P>) => {
      const rmp: number = useMemoShallowEqual(() => Math.random(), props)
      const rmm: number = useMemoShallowEqual(() => Math.random(), modelsInited)
      const modelsRef = useRef(modelsInited)
      modelsRef.current = {
        ...modelsRef.current,
        ...modelsInited
      }
      const cleanUpRef = useRef(() => {})
      const { effectsCleanUp, models, selectors, actions } = useMemo(() => {
        const combine = toCombine(modelsRef.current, props as P)
        modelsRef.current = combine.models
        return combine
      }, [rmm, rmp])
      cleanUpRef.current = () => {
        if (typeof effectsCleanUp === 'function') {
          effectsCleanUp()
        }
      }
      useEffect(() => () => (true && cleanUpRef.current)(), [rmm, rmp])
      const [state, _updateState] = useState<InitializerModelState<M>>(() => getStateFromModels(models))
      const updateState = (s: InitializerModelState<M>) => {
        _updateState(s)
      }
      return (
        <ModelsContext.Provider value={{ models, state, selectors, actions }}>
          <SubscribeModelsState models={models} updateState={updateState} />
          {children}
        </ModelsContext.Provider>
      )
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
          return typeof selector !== 'function' ? undefined : selector(target)
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

    const toComponent: ComponentHOC<M, P, S, A> = (Component) => {
      const ComponentWithHelpers = (props: PropsWithChildren<P>) => {
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
      return ComponentWithHelpers
    }

    const toWrappedComponent: ComponentHOC<M, P, S, A> = (Component) => {
      const ComponentWithHelpers = toComponent(Component)
      const ComponentWrappedWithProvider = (props: PropsWithChildren<ProviderProps<M> & P>) => {
        const { children, ...rest } = props
        return <Provider {...(rest as ProviderProps<M> & P)}>
          <ComponentWithHelpers {...props} />
        </Provider>
      }
      return ComponentWrappedWithProvider
    }

    return {
      Provider,
      toComponent,
      toWrappedComponent,
      useSelector,
      useSelected,
      useModels,
      useActions
    } as ContainerType<M, P, S, A>
  }
  return { createReactContainer }
}
