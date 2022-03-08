import { setupStore } from '@pure-model/core'

export type FilterType = 'all' | 'active' | 'completed'

const initialState = 'all'

export default function TodoFilter(){
  return setupStore({
    name: 'filter',
    initialState: initialState as FilterType,
    reducers: {
      setFilterType: (_: FilterType, filterType: FilterType) => filterType
    }
  })
}
