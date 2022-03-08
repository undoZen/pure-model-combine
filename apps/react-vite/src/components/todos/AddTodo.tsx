import { useMemo } from 'react'
import CaretDownIcon from '../icons/caret-down/CaretDownIcon'
import CaretDownSelectedIcon from '../icons/caret-down/CaretDownSelectedIcon'
import { HeaderProvider } from 'headless'

export const AddTodo = HeaderProvider.toComponent(({ actions, selected }) => {
  const { toggleAll, addTodo, changeHeaderText } = actions
  const { todos, headerText, isAllCompleted } = selected

  const td = useMemo(() => {
    console.log('tc changed')
    return todos
  }, [todos])
  console.log('tdc', td)

  const todosEmpty = !todos.length
  console.log('todos', todos.length, todos, !!isAllCompleted)

  function handleAddTodo(event) {
    if (event.key === 'Enter') {
      const { value } = event.target

      if (value.trim().length > 0) {
        addTodo(value)
        changeHeaderText('')
      }
    }
  }

  return (
    <div className="flex flex-row text-2xl h-16">
      <button
        role="button"
        type="button"
        className="w-8"
        onClick={() => toggleAll()}
      >
        {!todosEmpty && !isAllCompleted && <CaretDownIcon />}
        {!todosEmpty && isAllCompleted && <CaretDownSelectedIcon />}
      </button>
      <input
        type="text"
        className="flex-1 min-w-0 p-2 placeholder-gray-300"
        placeholder="What needs to be done?"
        onKeyPress={handleAddTodo}
        onChange={({ target }) => changeHeaderText(target.value)}
        value={headerText}
      />
    </div >
  )
})