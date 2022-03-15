import '../../styles/App.css'
import { TodosProvider } from '../adapt-headless'
import { Todos } from './todos'

function App () {
  return (
    <div className='app w-11/12 md:w-8/12 lg:w-6/12 mx-auto max-w-prose text-center mt-[-7px]'>
      <p className='app__title font-thin text-[100px]'>todos</p>

      <TodosProvider>
        <Todos />
      </TodosProvider>

      <Footer />
    </div>
  )
}
function Footer () {
  return (
    <div className='text-[#bfbfbf] text-xs mt-14 leading-loose'>
      <p className='font-extralight'>Double-click to edit a todo</p>
      <p className='font-extralight'>
        Made by{' '}
        <a className='font-normal' href='https://github.com/undozen'>
          @undoZen
        </a>
      </p>
      <p className='font-extralight'>
        Based on{' '}
        <a className='font-normal' href='https://todomvc.com/examples/react/'>
          React TodoMVC
        </a>
      </p>
      <p className='font-extralight'>
        Styles copied from{' '}
        <a
          className='font-normal'
          href='https://github.com/carlosfernandezcabrero/todo-app-react'
        >
          Carlos Fernandez&apos;s
        </a> and <a
          className='font-normal'
          href='https://wishawa.github.io/consecuit/todomvc/'
        >
          Wisha Wa&apos;s
        </a>
      </p>
    </div>
  )
}

export default App
