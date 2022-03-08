import { AddTodo } from './AddTodo'
import { TodosFooter } from './TodosFooter'
import { TodosList } from './TodosList'
export const Todos = () => {
  return (
    <div className="mt-8 shadow-xl w-full bg-white">
      <AddTodo />
      <TodosList />
      <TodosFooter />
    </div>
  )
}
