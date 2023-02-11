import { useOpenSpaceId } from 'appState/application/hooks'
import { observer } from 'mobx-react-lite'
import { Block, clientPool, Space } from 'state/state'
import styled, { useTheme } from 'styled-components/macro'
import { IconWrapper } from 'theme'
import { QuickIcon } from 'theme/components/icons'

const SuperContainer = styled.div`
  z-index: 1000;
`
const HeaderWrapper = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  height: 40px;
`

const Header = styled.div`
  display: flex;
  align-items: center;
`

const HeaderButton = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 10px;
  gap: 8px;

  background: ${({ theme }) => theme.backgroundSurface};
  color: ${({ theme }) => theme.text3};
  height: 32px;
  border-radius: 10px;
  margin-left: 12px;
  cursor: pointer;
  transition-duration: ${({ theme }) => theme.transition.duration.fast};
  transition-timing-function: ease-in-out;
  transition-property: opacity, color, background-color;

  :hover {
    opacity: ${({ theme }) => theme.opacity.hover};
  }
  user-select: none;
`

export const Overlay = observer(() => {
  const theme = useTheme()

  const openSpaceId = useOpenSpaceId()
  console.log('clientPool', clientPool)
  const space = clientPool.objects.find((o) => o.type === 'Space' && o.id === openSpaceId) as Space | null

  return (
    <SuperContainer>
      <HeaderWrapper>
        <Header>
          <HeaderButton
            onClick={() => {
              const block = new Block(crypto.randomUUID())
              const randomColorOptions = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink']
              if (space) {
                block.background = randomColorOptions[Math.floor(Math.random() * randomColorOptions.length)]
                block.space = space
                block.save()
              } else {
                throw new Error('No space')
              }
            }}
          >
            <IconWrapper>
              <QuickIcon color={theme.text3} height="14px" strokeWidth={2.5} />
            </IconWrapper>
            Add Block
          </HeaderButton>
        </Header>
      </HeaderWrapper>
    </SuperContainer>
  )
})
