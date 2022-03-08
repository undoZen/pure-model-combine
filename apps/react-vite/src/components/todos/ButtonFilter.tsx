import propTypes from 'prop-types'
import { FilterProvider } from 'headless'

export const ButtonFilter = ({ name, filterValue }) => {
  const { changeFilter } = FilterProvider.useActions()
  const { selectedType } = FilterProvider.useSelected()
  console.log({ selectedType })
  const handleTodoFilter = () => changeFilter(filterValue)

  return (
    <button
      type="button"
      className={`font-thin px-2 ${selectedType === filterValue && 'border rounded'
        }`}
    onClick={handleTodoFilter}
    >
      {name}
    </button>
  )
}

ButtonFilter.propTypes = {
  name: propTypes.string.isRequired,
  filterValue: propTypes.bool
}
