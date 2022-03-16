import { FilterType } from 'headless'
import { FilterProvider } from '../../adapt-headless'

export const ButtonFilter = ({ name, filterValue }: { name:string, filterValue: FilterType }) => {
  const { changeFilter } = FilterProvider.useActions()
  const { selectedType } = FilterProvider.useSelected()
  console.log({ selectedType })
  const handleTodoFilter = () => changeFilter(filterValue)

  const classes = `font-thin px-2 ${selectedType === filterValue && 'border rounded'}`
  return (
    <button type="button" className={classes} onClick={handleTodoFilter} >
      {name}
    </button>
  )
}
