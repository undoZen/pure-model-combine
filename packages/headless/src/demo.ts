import { setupStore } from '@pure-model/core'
import produce, { Draft } from 'immer'

export type DemoState = {
  count: number;
  text: string;
};

const initialState: DemoState = {
  count: 0,
  text: ''
}

export function DemoInitializer () {
  const { store, actions } = setupStore({
    initialState,
    reducers: {
      incr: produce((state: Draft<DemoState>) => {
        state.count += 1
      }),
      decr: produce((state: Draft<DemoState>) => {
        state.count -= 1
      }),
      changeText: produce((state: Draft<DemoState>, content: string) => {
        state.text = content
      })
    }
  })

  return { store, actions }
}
