import { adaptReact } from '@pure-model-combine/react'
import { globalModels, headerCombine, todosCombine, filterCombine, todoCombine } from 'headless'

const { toProvider } = adaptReact(globalModels)

export const HeaderProvider = toProvider(headerCombine)
export const TodosProvider = toProvider(todosCombine)
export const FilterProvider = toProvider(filterCombine)
export const TodoProvider = toProvider(todoCombine)
