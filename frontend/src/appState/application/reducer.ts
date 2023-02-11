import { createSlice } from '@reduxjs/toolkit'

export enum ApplicationModal {}

export interface ApplicationState {
  readonly openModal: ApplicationModal | null
  readonly openSpaceId: string | null
  readonly libraryOpen: boolean
}

const initialState: ApplicationState = {
  openModal: null,
  openSpaceId: null,
  libraryOpen: true,
}

const applicationSlice = createSlice({
  name: 'application',
  initialState,
  reducers: {
    setOpenModal(state, action) {
      state.openModal = action.payload
    },
    setOpenSpaceId(state, action) {
      state.openSpaceId = action.payload
    },
    setLibraryOpen(state, action) {
      state.libraryOpen = action.payload
    },
  },
})

export const { setOpenModal, setOpenSpaceId } = applicationSlice.actions
export default applicationSlice.reducer
