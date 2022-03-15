import { TodosProvider } from '../../adapt-headless'
import TodoItem from './TodoItem'

export const TodosList = () => {
  const { list } = TodosProvider.useSelected()

  if (!list.length) return <></>

  return (
    <>
      <ul className="contents">
        {list.map((todo) => {
          console.log('jsx todo', todo); return (
          <TodoItem key={todo.id} id={todo.id} />
          )
        })}
      </ul>
    </>
  )
}
