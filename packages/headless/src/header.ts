import { setupStore, setupPreloadCallback } from '@pure-model/core'
import { setupTodosContext } from './context'

export default function HeaderInitializer () {
  const ctx = setupTodosContext()

  const header = setupStore({
    name: 'header',
    initialState: '',
    reducers: {
      setHeaderText: (_: string, text: string) => text
    }
  })

  setupPreloadCallback(async () => {
    console.log('setupPreloadCallback')
    const text = await ctx.getInitialText()
    header.actions.setHeaderText(text)
  })

  return header
}
