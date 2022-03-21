import { FilterType } from 'headless'
import { FilterContainer } from '../../adapt-headless'

export const ButtonFilter = ({ name, filterValue }: { name:string, filterValue: FilterType }) => {
  const { changeFilter } = FilterContainer.useActions()
  const { selectedType } = FilterContainer.useSelected()
  console.log({ selectedType })
  const handleTodoFilter = () => changeFilter(filterValue)

  const classes = `font-thin px-2 ${selectedType === filterValue && 'border rounded'}`
  return (
    <button type="button" className={classes} onClick={handleTodoFilter} >
      {name}
    </button>
  )
}
