import { useAppDispatch, useAppSelector } from 'appState/hooks'
import { useCallback } from 'react'

import { AppState } from '../index'
import { ApplicationModal, setOpenModal, setOpenSpaceId } from './reducer'

export function useModalIsOpen(modal: ApplicationModal): boolean {
  const openModal = useAppSelector((state: AppState) => state.application.openModal)
  return openModal === modal
}

export function useToggleModal(modal: ApplicationModal): () => void {
  const isOpen = useModalIsOpen(modal)
  const dispatch = useAppDispatch()
  return useCallback(() => dispatch(setOpenModal(isOpen ? null : modal)), [dispatch, modal, isOpen])
}

export function useCloseModal(_modal: ApplicationModal): () => void {
  const dispatch = useAppDispatch()
  return useCallback(() => dispatch(setOpenModal(null)), [dispatch])
}

export function useOpenSpaceId(): AppState['application']['openSpaceId'] {
  return useAppSelector((state: AppState) => state.application.openSpaceId)
}

export const useSetOpenSpaceId = (): ((spaceId: string) => void) => {
  const dispatch = useAppDispatch()
  return useCallback(
    (spaceId: string) => {
      dispatch(setOpenSpaceId(spaceId))
    },
    [dispatch]
  )
}
