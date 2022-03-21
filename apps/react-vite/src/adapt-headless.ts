import { adaptReact } from '@pure-model-combine/react'
import { globalModels, headerCombine, todosCombine, filterCombine, todoCombine } from 'headless'

const { createReactContainer } = adaptReact(globalModels)

export const HeaderContainer = createReactContainer(headerCombine)
export const TodosContainer = createReactContainer(todosCombine)
export const FilterContainer = createReactContainer(filterCombine)
export const TodoContainer = createReactContainer(todoCombine)
