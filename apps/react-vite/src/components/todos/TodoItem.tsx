import { TodoContainer } from '../../adapt-headless'
import { KeyboardEventHandler } from 'react'
import CheckIcon from '../icons/CheckIcon'
import CloseIcon from '../icons/CloseIcon'
// import styles from 'styles/TodoItem.module.css'

const TodoItem = TodoContainer.toWrappedComponent(({ selected, actions }) => {
  const { todo, isEditing, editingValue } = selected
  if (!todo) {
    return null
  }
  const { remove, toggle, update, startEdit, submit, endEdit } = actions

  const handleKeyUp: KeyboardEventHandler<HTMLInputElement> = ({ key }) => {
    console.log('key', key)
    if (key === 'Escape') {
      endEdit()
      return null
    }
    if (key !== 'Enter') {
      return null
    }
    submit()
  }

  return (
    <li className="border-t-2 border-gray-100 text-2xl" >
      <div className={`flex flex-row group items-center ${isEditing ? 'hidden' : ''}`}>

        <button
          type="button"
          role="button"
          className={`border ${
            todo.completed ? 'border-[#77bfaf]' : 'border-[#ededed]'
          } rounded-full flex items-center justify-center w-8 h-8`}
          onClick={toggle}
        >
          {todo.completed && <CheckIcon />}
        </button>
        <label
        onDoubleClick={startEdit}
        className={'flex-1 min-w-0 flex items-center break-all p-2' + (todo.completed ? ' text-gray-500 line-through' : ' text-gray-800')}
  >
          {todo.content}
        </label>
        <button onClick={remove} className="w-8 text-red-700 opacity-0 group-hover:opacity-100">
          <CloseIcon />
        </button>
      </div>
      {isEditing && <div className="flex flex-row" >
        <div className="w-8" />
        <input
          type="text"
          className="flex-1 p-2 shadow-inner w-full"
          value={editingValue}
          onChange={({ target }) => update(target.value)}
          onKeyUp={handleKeyUp}
          onBlur={submit}
          autoFocus
        />
      </div>}
    </li>
  )
})

export default TodoItem
