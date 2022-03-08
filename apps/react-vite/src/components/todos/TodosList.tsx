import { TodosProvider } from 'headless'
import TodoItem from './TodoItem'

export const TodosList = () => {
  let { list } = TodosProvider.useSelected()

  if (!list.length) return <></>

  return (
    <>
      <ul className="contents">
        {list.map(({ id }) => (
          <TodoItem key={id} id={id} />
        ))}
      </ul>
    </>
  )
}
