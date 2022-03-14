import { setupStore } from '@pure-model/core'
import produce, { Draft } from 'immer'

export type EditState = {
  status: boolean;
  content: string;
};

const initialState: EditState = {
  status: false,
  content: ''
}

export default function EditInitializer () {
  const edit = setupStore({
    initialState,
    reducers: {
      disable: (state: EditState) => produce(state, (state: Draft<EditState>) => {
        state.status = false
      }),
      enable: (state: EditState) => produce(state, (state: Draft<EditState>) => {
        state.status = true
      }),
      update: produce((state: Draft<EditState>, content: string) => {
        state.content = content
      })
    }
  })

  return edit
}
