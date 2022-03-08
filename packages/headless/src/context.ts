import { createModelContext, setupContext, ModelContextValue } from '@pure-model/core'

export interface TodosInterface {
  getInitialText: () => Promise<string>
}

export type TodosContext = ModelContextValue<TodosInterface>

export const todosContext = createModelContext<TodosInterface>({
  getInitialText: async () => ''
})

export const setupTodosContext = () => {
  return setupContext(todosContext)
}
