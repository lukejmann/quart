import { X } from 'react-feather'
import { Link } from 'react-router-dom'
import styled, { css } from 'styled-components/macro'

export const CloseIcon = styled(X)<{ onClick: () => void }>`
  color: ${({ theme }) => theme.text2};
  cursor: pointer;
`

export const IconWrapper = styled.div<{ stroke?: string; size?: string; marginRight?: string; marginLeft?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ size }) => size ?? '20px'};
  height: ${({ size }) => size ?? '20px'};
  margin-right: ${({ marginRight }) => marginRight ?? 0};
  margin-left: ${({ marginLeft }) => marginLeft ?? 0};
  & > * {
    stroke: ${({ theme, stroke }) => stroke ?? theme.accentActive};
  }
`

export const ClickableStyle = css`
  text-decoration: none;
  cursor: pointer;
  transition-duration: ${({ theme }) => theme.transition.duration.fast};

  :hover {
    opacity: ${({ theme }) => theme.opacity.hover};
  }
  :active {
    opacity: ${({ theme }) => theme.opacity.click};
  }
`

export const LinkStyle = css`
  color: ${({ theme }) => theme.accentAction};
  stroke: ${({ theme }) => theme.accentAction};
  font-weight: 500;
`

// An internal link from the react-router-dom library that is correctly styled
export const StyledInternalLink = styled(Link)`
  ${ClickableStyle}
  ${LinkStyle}
`

export const HideSmall = styled.span`
  ${({ theme }) => theme.deprecated_mediaWidth.deprecated_upToSmall`
    display: none;
  `};
`

export const HideExtraSmall = styled.span`
  ${({ theme }) => theme.deprecated_mediaWidth.deprecated_upToExtraSmall`
    display: none;
  `};
`

export const SmallOnly = styled.span`
  display: none;
  ${({ theme }) => theme.deprecated_mediaWidth.deprecated_upToSmall`
    display: block;
  `};
`

export const MediumOnly = styled.span`
  display: none;
  @media (max-width: ${({ theme }) => theme.breakpoint.md}px) {
    display: block;
  }
`

export const Separator = styled.div`
  width: 100%;
  height: 1px;
  background-color: ${({ theme }) => theme.backgroundOutline};
`

export const GlowEffect = styled.div`
  border-radius: 32px;
  box-shadow: ${({ theme }) => theme.networkDefaultShadow};
`
