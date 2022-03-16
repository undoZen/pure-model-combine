import { HeaderProvider } from '../../adapt-headless'
import CaretDownIcon from '../icons/caret-down/CaretDownIcon'
import CaretDownSelectedIcon from '../icons/caret-down/CaretDownSelectedIcon'

export const AddTodo = HeaderProvider.toComponent(({ actions, selected }) => {
  const { toggleAll, addTodo, changeHeaderText } = actions
  const { headerText, isAllCompleted, isEmpty } = selected

  return (
    <div className="flex flex-row text-2xl h-16">
      <button
        role="button"
        type="button"
        className="w-8"
        onClick={() => toggleAll()}
      >
        {!isEmpty && !isAllCompleted && <CaretDownIcon />}
        {!isEmpty && isAllCompleted && <CaretDownSelectedIcon />}
      </button>
      <input
        type="text"
        className="flex-1 min-w-0 p-2 placeholder-gray-300"
        placeholder="What needs to be done?"
        onKeyPress={(event) => {
          if (event.key === 'Enter') {
            addTodo()
          }
        }}
        onChange={({ target }) => changeHeaderText(target.value)}
        value={headerText}
      />
    </div >
  )
})
