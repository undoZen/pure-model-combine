import { Actions, createHeadlessContainer, CombineData, getStateFromModels, Initializer, InitializerModels, InitializerModelState, ModelRecord, Selectors, States } from '@pure-model-combine/core'
import { ModelContextValue } from '@pure-model/core'
import { shallowEqual } from 'fast-equals'
import React, { createContext, FunctionComponent, MutableRefObject, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createTrackedSelector } from 'react-tracked'
import { useSubscription } from 'use-subscription'

export * from 'redux'

type IR = Record<string, Initializer>

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
type ProviderTypeProps<M extends IR, A extends Actions> =
  PropsWithChildren<ProviderProps<M> & {
    actionsRef?: MutableRefObject<A>
  }>
type ProviderType<M extends IR, A extends Actions> =
  FunctionComponent<ProviderTypeProps<M, A>>
type ContainerType<M extends IR, S extends Selectors<M>, A extends Actions> =
  Helplers<M, S, A>
  & { Provider: ProviderType<M, A>}
type Selector<M extends IR, Selected extends any = InitializerModelState<M>> = (state: InitializerModelState<M>) => Selected
type SelectorReturn<M extends IR, S extends Selector<M>> = ReturnType<S>
type SelectorsReturnType<M extends IR, SS extends Selectors<M>> = {
  [K in keyof SS]: SelectorReturn<M, SS[K]>
}

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
  if (!shallowEqual(models, modelsRef.current) || !subsRef.current) {
    modelsRef.current = models
    subsRef.current = {
      getCurrentValue: () => stateRef.current,
      subscribe: (callback: (states: States<SS>) => void) => {
        const currentState = getStateFromModels(models)
        if (!shallowEqual(currentState, stateRef.current)) {
          stateRef.current = currentState
        }
        const subscriptions = Object.keys(models).map((key: keyof SS) => {
          return models[key].store.subscribe(() => {
            const newState = models[key].store.getState()
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
        }
      }
    }
  }
  return useSubscription(subsRef.current)
}

export const createReactContainer = <M extends IR, S extends Selectors<M>, A extends Actions>(combineData: CombineData<M, S, A>, context?: ModelContextValue) => {
  const { toCombine } = createHeadlessContainer(combineData, context)
  const ModelsContext = createContext<ModelContextProviderProps<M, S, A> | null>(null)
  function SubscribeModelsState ({ models, updateState }: ModelSubscriberProps<M>) {
    const state = useModelsState(models)
    updateState(state)
    console.log('updateState(state) called', state)
    return null
  }

  const Provider:ProviderType<M, A> = ({ children, models: modelsInited = {}, actionsRef }: ProviderTypeProps<M, A>) => {
    const versionRef = useRef(0)
    const modelsInitedRef = useRef(modelsInited)
    if (!shallowEqual(modelsInited, modelsInitedRef.current)) {
      modelsInitedRef.current = modelsInited
      versionRef.current++
    }
    const modelsChanged = versionRef.current
    const modelsRef = useRef(modelsInited)
    const { effectsCleanUp, models, selectors, actions } = useMemo(() => {
      const combine = toCombine(modelsRef.current)
      modelsRef.current = combine.models
      if (actionsRef) {
        actionsRef.current = combine.actions
      }
      return combine
    }, [modelsChanged])
    const cleanUpRef = useRef(() => {})
    cleanUpRef.current = () => {
      if (typeof effectsCleanUp === 'function') {
        effectsCleanUp()
        cleanUpRef.current = () => { }
      }
    }
    useEffect(() => () => (true && cleanUpRef.current)(), [modelsChanged])
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

  return {
    Provider,
    useSelector,
    useSelected,
    useModels,
    useActions
  } as ContainerType<M, S, A>
}
