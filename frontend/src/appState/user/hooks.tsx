import { useAppDispatch, useAppSelector } from 'appState/hooks'
import { useCallback } from 'react'
import { shallowEqual } from 'react-redux'

import { setUserId } from './reducer'

export function useUserId() {
  const { userId } = useAppSelector(({ user: { userId } }) => ({ userId }), shallowEqual)
  return userId
}

export function useSetUserId() {
  const dispatch = useAppDispatch()
  return useCallback((userId: string) => dispatch(setUserId(userId)), [dispatch])
}
