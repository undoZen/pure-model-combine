import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPureModel, Initializer, InitializerState, Model } from '@pure-model/core'
import { shallowEqual } from 'fast-equals'
import mapValues from 'lodash.mapvalues'
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
export type InitializerModelState<SS extends IR> = {
  [K in keyof SS]: InitializerState<SS[K]>
}
type Selectors<M extends IR> =
  (props: any) => Record<string, (state: InitializerModelState<M>) => any>
type Actions<M extends IR> =
  (models: InitializerModels<M>) => Record<string, (...args: any[]) => void>
type CombineData<M extends IR> = {
  models: M
  selectors?: Selectors<M>
  actions?: Actions<M>
}
type AnyVisitor<M extends IR> = (combineData: CombineData<M>) => any
type Combine<M extends IR> = (visitor: AnyVisitor<M>) => any
type TransVisitor<M extends IR> = (combineData: CombineData<M>) => Combine<M>
type CreateModels = <M extends IR>(modelInitializers: M) => Combine<M>
type CreateModelsSelectors = <M extends IR>(modelInitializers: M, selectors: Selectors<M>) => Combine<M>
// type CreateModelsAction = <M extends IR>(modelInitializers: M, actions: Actions<M>) => Combine<M>
type CreateModelsSelectorsActions = <M extends IR>(modelInitializers: M, selectors: Selectors<M>, actions: Actions<M>) => Combine<M>
type CreateCombine = CreateModels | CreateModelsSelectors | CreateModelsSelectorsActions

function getStateFromModels<SS extends ModelRecord>(models: SS): States<SS> {
  return Object.keys(models).reduce((acc, key) => {
    acc[key as keyof SS] = models[key].store.getState()
    return acc
  }, {} as States<SS>)
}
export function subscribeModels<SS extends ModelRecord>(models: SS, callback: (models: States<SS>) => void) {
  const cachedState = getStateFromModels(models)
  const subscriptions = Object.keys(models).map((key: keyof SS) => {
    return models[key].store.subscribe(() => {
      callback({
        ...cachedState,
        [key]: models[key].store.getState()
      })
    })
  })
  return () => {
    subscriptions.forEach(unsubscribe => unsubscribe())
  }
}

export function useModelStates<SS extends ModelRecord>(
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

function useModels<SS extends ModelRecord>(
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
  const gm = useCallback(function getModels() { return modelsRef.current }, [])
  return [useSubscription(subsRef.current), gm]
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

const useIsomorphicLayoutEffect =
  // tslint:disable-next-line: strict-type-predicates
  typeof window !== 'undefined' &&
    // tslint:disable-next-line: strict-type-predicates
    typeof window.document !== 'undefined' &&
    // tslint:disable-next-line: deprecation & strict-type-predicates
    typeof window.document.createElement !== 'undefined'
    ? useLayoutEffect
    : useEffect

export const adaptReact = (globalModels: Initializer[]) => {
  const deps = new Map<Initializer, Model>()

  const toProvider = () => <M extends IR>(combineData: CombineData<M>) => {
    const ModelsContext = createContext({ models: {} as InitializerModels<M>, state: {} as InitializerModelState<M> })
    function ModelsStatesProvider({
      children,
      models,
      ...props
    }: PropsWithChildren<{ models: InitializerModels<SS> }>) {
      console.log('models', models)
      const state = useModelStates(models)
      return (
        <ModelsContext.Provider value={{ models, state, ...props }}>
          {children}
        </ModelsContext.Provider>
      )
    }
    const { models: modelInitializers } = combineData
    const getSelectors = combineData.selectors || (() => ({}))
    const getActions = combineData.actions || (() => ({}))
    function Provider({ children, ...props }: PropsWithChildren<any>) {
      const rnm: number = useMemoShallowEqual(() => Math.random(), modelInitializers)
      const models = useMemo(() => {
        return mapValues(modelInitializers, (initializer, name) => {
          if (globalModels.includes(initializer)) {
            return undefined
          }
          return createPureModel(initializer)
        })
      }, [rnm]) as InitializerModels<M>
      Object.keys(modelInitializers).forEach((name) => {
        const initializer = modelInitializers[name] as Initializer
        if (!globalModels.includes(initializer)) {
          return
        }
        let dep = deps.get(initializer)
        if (!dep) {
          // console.log('cpm', name, initializer)
          dep = createPureModel(initializer)
          deps.set(initializer, dep)
          return
        }
        // console.log('dep cache hit', initializer, dep)
        models[name as keyof M] = dep
      })
      // console.log('models', models)
      const rnp: number = useMemoShallowEqual(() => Math.random(), props)
      const selectors = useMemo(() => getSelectors(props), [rnp])
      const actions = useMemo(() => getActions(models, props), [rnp])
      return <ModelsStatesProvider models={models} selectors={selectors} actions={actions} {...props}>{children}</ModelsStatesProvider>
    }

    const useSelector = (selector: (state: InitializerModelState<M>) => any) => {
      const state = useContext(ModelsContext).state
      console.log('state', state)
      return selector(state)
    }
    const useTrackedSelector = createTrackedSelector(useSelector)
    const useSelected = () => {
      const state = useTrackedSelector()
      const selectors = useContext(ModelsContext).selectors
      return new Proxy(state as any, {
        get(target, key) {
          console.log('in proxy', key, target)
          const selector = selectors[key]
          return typeof selector !== 'function' ? null : selector(target)
        }
      })
    }
    const useModels = () => {
      const models = useContext(ModelsContext).models
      console.log('useModels', models)
      return models
    }
    const useActions = () => {
      const actions = useContext(ModelsContext).actions
      console.log('useActions', actions)
      return actions
    }
    Provider.useSelector = useTrackedSelector
    Provider.useSelected = useSelected
    Provider.useModels = useModels
    Provider.useActions = useActions

    function toComponent(Component: any) {
      const ComponentWrapped = ({ children, ...props }: PropsWithChildren<any>) => {
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
      function ComponentWrappedWithProvider({ children, ...props }: PropsWithChildren<any>) {
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
  selectorsOrActions?: Selectors<M> | Actions<M> | null,
  actions?: Actions<M>
) => {
  return (visitor: AnyVisitor<M>) => visitor({
    models: modelInitializers,
    selectors: selectorsOrActions || undefined,
    actions: actions
  })
}
