import { TodosContainer } from '../../adapt-headless'
import TodoItem from './TodoItem'

export const TodosList = () => {
  const { list } = TodosContainer.useSelected()

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
