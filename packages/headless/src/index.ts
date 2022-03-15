import { adaptReact, createCombine } from '@pure-model-combine/core'
import EditInitializer from './edit'
import TodoFilter, { FilterType } from './filter'
import HeaderInitializer from './header'
import TodosInitializer from './todos'

export const { toProvider } = adaptReact([TodosInitializer, TodoFilter])

export const headerCombine = createCombine({
  todos: TodosInitializer,
  header: HeaderInitializer
}, (props, models) => {
  // type State = ReturnType<typeof getState>
  return {
    selectors: {
      headerText: (state) => state.header,
      todos: (state) => state.todos,
      isAllCompleted: ({ todos }) => todos.every(({ completed }) => completed)
    },
    actions: {
      toggleAll: () => models.todos.actions.toggleAll(),
      changeHeaderText: (text: string) => {
        return models.header.actions.setHeaderText(text)
      },
      addTodo: () => {
        const text = models.header.store.getState()
        models.todos.actions.addTodo(text)
        models.header.actions.setHeaderText('')
      }
    }
  }
})
export const HeaderProvider = headerCombine(toProvider())

const todosCombine = createCombine({
  todo: TodosInitializer,
  filter: TodoFilter
}, () => ({
  selectors: {
    count: (state) => state.todo.length,
    list: (state) => {
      if (state.filter === 'all') {
        return state.todo
      } else if (state.filter === 'active') {
        return state.todo.filter(todo => !todo.completed)
      } else if (state.filter === 'completed') {
        return state.todo.filter(todo => todo.completed)
      }
    }
  },
  actions: {}
))

export const TodosProvider = todosCombine(toProvider())
const f = () => {
  TodosProvider.useSelected()
}

const filterCombine = createCombine({
  todos: TodosInitializer,
  filter: TodoFilter
}, (props, models) => ({
  selectors: {
    selectedType: (state) => state.filter,
    leftCount: (state) => state.todos.filter(todo => !todo.completed).length,
    allCount: (state) => state.todos.length
  },
  actions: {
    clearCompleted: () => models.todos.actions.clearCompleted(),
    changeFilter: (type: FilterType) => {
      models.filter.actions.setFilterType(type)
    }
  }
}))
export const FilterProvider = filterCombine(toProvider())

type TodoProps = {
  id: number
}
export const todoCombine = createCombine({
  todos: TodosInitializer,
  edit: EditInitializer
}, (props: TodoProps, models, getState) => {
  type State = ReturnType<typeof getState>
  const todo = ({ todos }: State) => todos.find(({ id }) => id === props.id)
  const isEditing = (state: State) => state.edit.status
  const toggle = () => {
    models.todos.actions.toggleTodo(props.id)
  }
  const remove = () => {
    models.todos.actions.removeTodo(props.id)
  }
  const update = (content: string) => {
    models.edit.actions.update(content)
  }
  const startEdit = () => {
    const content = todo(getState())?.content || ''
    models.edit.actions.update(content)
    models.edit.actions.enable()
  }
  const endEdit = () => {
    models.edit.actions.disable()
  }
  const submit = () => {
    const content = models.edit.store.getState().content
    models.todos.actions.updateTodo({ id: props.id, content })
    endEdit()
  }
  return {
    selectors: {
      editingValue: (state) => isEditing(state) ? state.edit.content : todo(state)?.content || '',
      isEditing,
      todo
    },
    actions: {
      toggle,
      remove,
      update,
      startEdit,
      endEdit,
      submit
    }
  }
})
export const TodoProvider = todoCombine(toProvider())
