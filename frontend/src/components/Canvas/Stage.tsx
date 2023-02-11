import { Sky } from '@react-three/drei'
import { useOpenSpaceId } from 'appState/application/hooks'
import { motion } from 'framer-motion-3d'
import * as React from 'react'
import { clientPool } from 'state/state'

type BoundsProps = JSX.IntrinsicElements['group'] & {
  eps?: number
}
export function Stage({ children }: BoundsProps): JSX.Element {
  const openSpaceId = useOpenSpaceId()
  React.useEffect(() => {
    if (openSpaceId) clientPool.requestPullIfNeeded('Space', openSpaceId)
  }, [openSpaceId])

  return (
    <motion.group castShadow receiveShadow>
      <Sky sunPosition={[0, 20, 0]} distance={1000} rayleigh={10} />
      <ambientLight intensity={0.3} />
      <pointLight castShadow intensity={0.8} position={[100, 100, 100]} />
      {children}
    </motion.group>
  )
}
