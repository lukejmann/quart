import { createSlice } from '@reduxjs/toolkit'

export interface UserState {
  userId: string | null
}

export const initialState: UserState = {
  userId: '1',
}

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUserId: (state, action) => {
      state.userId = action.payload
    },
    extraReducers: (builder) => {
      //
    },
  },
})

export const { setUserId } = userSlice.actions
export default userSlice.reducer
