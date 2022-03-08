import { ButtonFilter } from './ButtonFilter'
import { FilterProvider } from 'headless'

export const TodosFooter = FilterProvider.toComponent(({ actions, selected }) => {
  const { leftCount, allCount } = selected
  const { clearCompleted } = actions
  console.log({ leftCount, allCount })

  return (
    <div style={{ boxShadow: '0 1px 1px rgb(0 0 0 / 20%), 0 8px 0 -3px #f6f6f6, 0 9px 1px -3px rgb(0 0 0 / 20%), 0 16px 0 -6px #f6f6f6, 0 17px 2px -6px rgb(0 0 0 / 20%)' }}>
      <div className="grid grid-cols-3 py-3 px-5 font-thin text-[14px] text-[#777] bg-[#fff]">
        <div className="text-left">
          <p>{leftCount} items left</p>
        </div>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <ButtonFilter name="All" filterValue='all' />
          <ButtonFilter name="Active" filterValue='active' />
          <ButtonFilter name="Completed" filterValue='completed' />
        </div>
        <div className="text-right">
          {allCount > leftCount && (
            <button
              onClick={() => clearCompleted()}
              className="font-thin"
              role='button'
              type='button'
            >
              Clear Completed
            </button>
          )}
        </div>
      </div>
    </div>
  )
})
