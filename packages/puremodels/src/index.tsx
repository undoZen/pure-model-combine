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
export type ModelRecord = Record<string, Model<any>>
export type InitializerModel<I extends Initializer<any>> = Model<InitializerState<I>>
export type InitializerModels<SS extends Record<string, Initializer<any>>> = {
  [K in keyof SS]: InitializerModel<SS[K]>
}
export type InitializerModelState<SS extends Record<string, Initializer<any>>> = {
  [K in keyof SS]: InitializerState<SS[K]>
}
type Models<M extends Record<string, Initializer>> = {
  type: 'onlyModels',
  models: M
}
type Selectors<M extends Record<string, Initializer>> =
  (props: any) => Record<string, (state: InitializerModelState<M>) => any>
type Actions<M extends Record<string, Initializer>> =
  (models: InitializerModels<M>) => Record<string, (...args: any[]) => void>
type ModelsSelectors<M extends Record<string, Initializer>> = {
  type: 'modelsAndSelectors'
  models: M
  selectors: Selectors<M>
}
type ModelsActions<M extends Record<string, Initializer>> = {
  type: 'modelsAndActions'
  models: M
  actions: Actions<M>
}
type ModelsSelectorsActions<M extends Record<string, Initializer>> = {
  type: 'modelsAndSelectorsAndActions'
  models: M
  selectors: Selectors<M>
  actions: Actions<M>
}
type CombineData<M extends Record<string, Initializer>> = Models<M> | ModelsSelectors<M> | ModelsActions<M> | ModelsSelectorsActions<M>
type AnyVisitor<M extends Record<string, Initializer>> = (combineData: CombineData<M>) => any
type Combine<M extends Record<string, Initializer>> = (visitor: AnyVisitor<M>) => any
type TransVisitor<M extends Record<string, Initializer>> = (combineData: CombineData<M>) => Combine<M>
type CreateModels = <M extends Record<string, Initializer>>(modelInitializers: M) => Combine<M>
type CreateModelsSelectors = <M extends Record<string, Initializer>>(modelInitializers: M, selectors: Selectors<M>) => Combine<M>
// type CreateModelsAction = <M extends Record<string, Initializer>>(modelInitializers: M, actions: Actions<M>) => Combine<M>
type CreateModelsSelectorsActions = <M extends Record<string, Initializer>>(modelInitializers: M, selectors: Selectors<M>, actions: Actions<M>) => Combine<M>
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

const getToProvider = (globalModels: Initializer[]) => () => {
  const ModelsContext = createContext<any>({ models: {}, state: {} })
  function ModelsProvider({
    children,
    ...props
  }: PropsWithChildren<{ models: any }>) {
    console.log('models', props.models)
    const state = useModelStates(props.models)
    return (
      <ModelsContext.Provider value={{ ...props, state }}>
        {children}
      </ModelsContext.Provider>
    )
  }
  return (combineData: any) => {
    const { models: modelInitializers } = combineData
    const getSelectors = combineData.selectors || (() => ({}))
    const getActions = combineData.actions || (() => ({}))
    function Provider({ children, ...props }: PropsWithChildren<any>) {
      const rnp: number = useMemoShallowEqual(() => Math.random(), props)
      const selectors = useMemo(() => getSelectors(props), [rnp])
      const rnm: number = useMemoShallowEqual(() => Math.random(), modelInitializers)
      const models = useMemo(() => {
        console.log('create models')
        return mapValues(modelInitializers, (initializer, name) => {
          if (globalModels.includes(initializer)) {
            console.log('cpm1g', name, initializer)
            return undefined
          }
          console.log('cpm1', name, initializer)
          return createPureModel(initializer)
        })
      }, [rnm])
      const modelsCache = Object.keys(modelInitializers).map((name) => {
        const initializer = modelInitializers[name] as Initializer
        if (!globalModels.includes(initializer)) {
          return false
        }
        let dep = deps.get(initializer)
        if (dep) {
          console.log('dep cache hit', initializer, dep)
          return [name, dep]
        }
        console.log('cpm2', name, initializer)
        dep = createPureModel(initializer)
        deps.set(initializer, dep)
        return [name, dep]
      }).filter(Boolean)
      console.log('modelsCache', modelsCache)
      // @ts-ignore
      modelsCache.forEach(([name, dep]) => {
        models[name] = dep
      })
      console.log('models', models)
      const actions = useMemo(() => getActions(models, props), [rnp])
      return <ModelsProvider models={models} selectors={selectors} actions={actions} {...props}>{children}</ModelsProvider>
    }

    const useSelector = () => {
      const state = useContext(ModelsContext).state
      console.log('state', state)
      return state
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
}
export const adaptReact = (globalModels: Initializer[]) => {
  return {
    toProvider: getToProvider(globalModels)
  }
}
const deps = new Map<Initializer, Model>()

export const createModels: CreateModels = (modelInitializers) => {
  return (visitor) => visitor({ type: 'onlyModels', models: modelInitializers })
}
// type AddActions = <M extends Record<string, Initializer>>(actions: Actions<M>) =>
// (combine: Combine<M>) => Combine<M>
type AddActions<M = any> = M extends Record<string, Initializer> ? (actions: Actions<M>) => TransVisitor<M> : never
type AddSelectors<M = any> = M extends Record<string, Initializer> ? (selectors: Selectors<M>) => TransVisitor<M> : never

export const addActions: AddActions = (actions) => (combineData) => {
  if (combineData.type === 'onlyModels') {
    return (v) => v({ type: 'modelsAndActions', models: combineData.models, actions })
  } else if (combineData.type === 'modelsAndSelectors') {
    return (v) => v({ type: 'modelsAndSelectorsAndActions', models: combineData.models, selectors: combineData.selectors, actions })
  } else {
    const _actions = actions
    actions = (models: Record<string, Model<any>>) => ({
      ...combineData.actions(models),
      ..._actions(models)
    })
    if (combineData.type === 'modelsAndActions') {
      return (v) => v({ type: 'modelsAndActions', models: combineData.models, actions })
    } else {
      return (v) => v({ type: 'modelsAndSelectorsAndActions', models: combineData.models, selectors: combineData.selectors, actions })
    }
  }
}
export const addSelectors: AddSelectors = (selectors) => (combineData) => {
  if (combineData.type === 'onlyModels') {
    return (v) => v({ type: 'modelsAndSelectors', models: combineData.models, selectors })
  } else if (combineData.type === 'modelsAndActions') {
    return (v) => v({ type: 'modelsAndSelectorsAndActions', models: combineData.models, actions: combineData.actions, selectors })
  } else {
    const _selectors = selectors
    selectors = (props: any) => ({
      ...combineData.selectors(props),
      ..._selectors(props)
    })
    if (combineData.type === 'modelsAndSelectors') {
      return (v) => v({ type: 'modelsAndSelectors', models: combineData.models, selectors })
    } else {
      return (v) => v({ type: 'modelsAndSelectorsAndActions', models: combineData.models, actions: combineData.actions, selectors })
    }
  }
}

export const createCombine: CreateCombine = <M extends Record<string, Initializer>>(
  modelInitializers: M,
  selectorsOrActions: Selectors<M> | Actions<M> | undefined | null,
  actions: Actions<M>
) => {
  let combine: Combine<M> = createModels(modelInitializers)
  if (selectorsOrActions) {
    combine = combine(addSelectors(selectorsOrActions))
  }
  if (actions) {
    combine = combine(addActions(actions))
  }
  return combine
}
