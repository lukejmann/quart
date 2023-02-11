import { useOpenSpaceId, useSetOpenSpaceId } from 'appState/application/hooks'
import { useSetUserId, useUserId } from 'appState/user/hooks'
import { SpaceCanvas } from 'components/Canvas/Canvas'
import { Overlay } from 'components/Overlay/Overlay'
import { useEffect, useState } from 'react'
import { clientPool, Space, User } from 'state/state'
import styled from 'styled-components/macro'

const AppWrapper = styled.div`
  width: 100%;
  height: 100%;
`

const BodyWrapper = styled.div`
  display: flex;
  flex-direction: row;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  padding: 0px 0px 0px 0px;
  align-items: center;
  flex: 1;
`

const CanvasWrapper = styled.div`
  position: relative;
  display: flex;
  width: 100%;
  height: calc(100vh);
  padding: 0px;
`

export default function App() {
  // const { pathname } = useLocation()
  const useSpace = useOpenSpaceId()

  const setUserId = useSetUserId()
  const userId = useUserId()
  const setSpace = useSetOpenSpaceId()

  const [hasRunInit, setHasRunInit] = useState(false)

  const [running, setRunning] = useState(false)

  useEffect(() => {
    const run = async () => {
      if (running) return
      setRunning(true)
      if (!userId && !hasRunInit) {
        clientPool.requestPullIfNeeded('User', '7ecf02ea-1065-48be-ad85-25d12')
        const userPulled = await clientPool.awaitObject('User', '7ecf02ea-1065-48be-ad85-25d12')
        // console.log('ONTSTATE u', user)
        if (userPulled) setUserId('7ecf02ea-1065-48be-ad85-25d12')
        else {
          if (hasRunInit) return
          const user = new User('7ecf02ea-1065-48be-ad85-25d12')
          user.username = 'username'
          user.save()
          const space = new Space('space1')
          space.title = 'Untitled Space EP'
          space.user = user
          space.save()
          setUserId('7ecf02ea-1065-48be-ad85-25d12')
          setSpace('space1')
          setHasRunInit(true)
        }
      }
      setRunning(false)
    }
    run()
  }, [hasRunInit, running, setSpace, setUserId, userId])

  return (
    <AppWrapper>
      <BodyWrapper>
        <Overlay></Overlay>
        <CanvasWrapper>
          <SpaceCanvas />
        </CanvasWrapper>
      </BodyWrapper>
    </AppWrapper>
  )
}
