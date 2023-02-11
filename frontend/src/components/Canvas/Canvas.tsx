import { Bounds, Edges, RoundedBox } from '@react-three/drei'
import { Canvas, useThree, Vector3 } from '@react-three/fiber'
import { useDrag, usePinch } from '@use-gesture/react'
import { useOpenSpaceId } from 'appState/application/hooks'
import { useMotionValue } from 'framer-motion'
import { MotionConfig } from 'framer-motion'
import { motion } from 'framer-motion-3d'
import { runInAction } from 'mobx'
import { observer } from 'mobx-react-lite'
import * as React from 'react'
import { Block, clientPool, Space } from 'state/state'
import styled, { useTheme } from 'styled-components/macro'
import ThemeProvider, { ThemedGlobalStyle } from 'theme'
import * as THREE from 'three'

import { CameraControls } from './camera-controls'
import { Select } from './Select'
import { Stage } from './Stage'

const CanvasContainer = styled.div`
  position: relative;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  width: 100%;
  height: 100%;
`

const BlockContent = observer(({ block }: { block: Block }) => {
  const ref1 = React.useRef<any>()
  const depth = 0.01
  const radius = 0.05
  const smoothness = 4
  const steps = 1
  const eps = 0.0001
  const curveParams = {
    depth: depth - radius * 2,
    bevelEnabled: true,
    bevelSegments: smoothness * 2,
    steps,
    bevelSize: radius - eps,
    bevelThickness: radius,
    curveSegments: smoothness,
  }
  function createShape(width: number, height: number, radius0: number) {
    const shape = new THREE.Shape()
    const radius = radius0 - eps
    shape.absarc(eps - width / 2, eps - height / 2, eps, -Math.PI / 2, -Math.PI, true)
    shape.absarc(eps - width / 2, height - radius * 2 - height / 2, eps, Math.PI, Math.PI / 2, true)
    shape.absarc(width - radius * 2 - width / 2, height - radius * 2 - height / 2, eps, Math.PI / 2, 0, true)
    shape.absarc(width - radius * 2 - width / 2, eps - height / 2, eps, 0, -Math.PI / 2, true)
    return shape
  }
  const width = block.size.width
  const height = block.size.height
  const shape = React.useMemo(() => createShape(width, height, radius), [width, height, radius])

  const theme = useTheme()
  console.log('BlockContent theme:', theme)

  return (
    <mesh uuid={'block-mesh' + block.id} position={[block.position.x, block.position.y, 0]}>
      <extrudeGeometry ref={ref1} args={[shape, curveParams]} />
      <meshStandardMaterial color={block.background} transparent opacity={0.8} roughness={0.5} metalness={0.5} />

      <Edges geometry={ref1.current} color={theme.blockBorder} threshold={1}></Edges>
    </mesh>
  )
})

const BlockNode = observer(({ block }: { block: Block }) => {
  return <BlockContent block={block} />
})

const SelectionOverlay = ({ blocks, setIsInUse }: { blocks: Block[]; setIsInUse: (isInUse: boolean) => void }) => {
  const { camera } = useThree()

  const minX = React.useMemo(() => {
    return Math.min(...blocks.map((b) => b.position.x - b.size.width / 2))
  }, [blocks])

  const maxX = React.useMemo(() => {
    return Math.max(...blocks.map((b) => b.position.x + b.size.width / 2))
  }, [blocks])

  const minY = React.useMemo(() => {
    return Math.min(...blocks.map((b) => b.position.y - b.size.height / 2))
  }, [blocks])

  const maxY = React.useMemo(() => {
    return Math.max(...blocks.map((b) => b.position.y + b.size.height / 2))
  }, [blocks])

  const [pointTopLeft, pointBottomRight] = React.useMemo(() => {
    return [new THREE.Vector3(minX, minY, 0), new THREE.Vector3(maxX, maxY, 0)]
  }, [maxX, maxY, minX, minY])

  const [position, setPosition] = React.useState([
    pointTopLeft.x + Math.abs(maxX - minX) / 2,
    pointTopLeft.y + Math.abs(maxY - minY) / 2,
    0,
  ])

  const bind = useDrag(({ down, movement: [mx, my], delta }) => {
    console.log(`down: ${down}`)
    console.log(`mx: ${mx}`)
    console.log(`my: ${my}`)
    const dx = delta[0] * camera.projectionMatrix.elements[0] * 0.01
    const dy = -1 * delta[1] * camera.projectionMatrix.elements[5] * 0.01
    if (down) {
      blocks.forEach((b) => {
        runInAction(() => {
          b.position.x += dx
          b.position.y += dy
        })
      })
      setIsInUse(true)
      const maxX = Math.min(...blocks.map((b) => b.position.x - b.size.width / 2))
      const minX = Math.max(...blocks.map((b) => b.position.x + b.size.width / 2))
      const maxY = Math.min(...blocks.map((b) => b.position.y - b.size.height / 2))
      const minY = Math.max(...blocks.map((b) => b.position.y + b.size.height / 2))
      const [pointTopLeft, pointBottomRight] = [new THREE.Vector3(minX, minY, 0), new THREE.Vector3(maxX, maxY, 0)]
      setPosition([pointTopLeft.x - Math.abs(maxX - minX) / 2, pointTopLeft.y - Math.abs(maxY - minY) / 2, 0])
    } else {
      setIsInUse(false)
      blocks.forEach((b) => {
        b.save()
      })
    }
  })

  const width = React.useMemo(() => {
    return pointBottomRight.x - pointTopLeft.x
  }, [pointBottomRight, pointTopLeft])

  const height = React.useMemo(() => {
    return pointBottomRight.y - pointTopLeft.y
  }, [pointBottomRight, pointTopLeft])

  const ref = React.useRef<THREE.Mesh>(null)
  return (
    <RoundedBox
      position={position as Vector3}
      args={[width * 1, height * 1, 0.02]}
      radius={0.02}
      smoothness={4}
      {...(bind() as any)}
      ref={ref}
      onClick={(e) => e.stopPropagation()}
    >
      <meshBasicMaterial color="blue" opacity={0.1} transparent />
      <Edges position={[-width / 2, -height / 2, 0.001]}>
        <meshBasicMaterial color="blue" />
      </Edges>
    </RoundedBox>
  )
}

const Blocks = observer(({ blocks }: { blocks: Block[] }) => {
  const [selectedBlockIDs, setSelectedBlockIDs] = React.useState<string[]>([])

  const selectedBlocks = React.useMemo(() => {
    return blocks.filter((b) => b && selectedBlockIDs.includes(b.id))
  }, [blocks, selectedBlockIDs])

  const selectionBoxIsActive = React.useMemo(() => {
    return selectedBlocks.length > 0
  }, [selectedBlocks])

  const [selectionBoxInUse, setSelectionBoxInUse] = React.useState(false)

  return (
    <group>
      {selectionBoxIsActive && (
        <SelectionOverlay
          blocks={selectedBlocks}
          setIsInUse={(isInUse) => {
            setSelectionBoxInUse(isInUse)
          }}
        />
      )}

      <ThemeProvider>
        <ThemedGlobalStyle></ThemedGlobalStyle>
        <Select
          box={false}
          multiple
          onChange={(active) => {
            setSelectedBlockIDs(active.map((a) => a.uuid.slice(10)))
          }}
          filter={(items) => {
            console.log(`items: ${JSON.stringify(items)}`)
            return items
          }}
        >
          {blocks.map((block) => block && <BlockNode key={block.id} block={block} />)}
        </Select>
      </ThemeProvider>
    </group>
  )
})

export const SpaceCanvas = observer(() => {
  const openSpaceId = useOpenSpaceId()
  React.useEffect(() => {
    if (openSpaceId) clientPool.requestPullIfNeeded('Space', openSpaceId)
  }, [openSpaceId])
  const space = clientPool.objects.find((o) => o.type === 'Space' && o.id === openSpaceId) as Space | null

  console.log(`clientPool.objects: ${JSON.stringify(clientPool.objects.length)}`)

  console.log('space: ', space)

  const { blocks } = space || { blocks: [] }

  console.log(`blocks: ${JSON.stringify(blocks.length)}`)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const transition = {
    type: 'spring',
    duration: 0.7,
    bounce: 0.2,
  }

  const cameraRef = React.useRef<CameraControls>(null)

  const bind = usePinch(
    ({ down, movement: [mx, my], delta, event }) => {
      event.preventDefault()
      if (cameraRef.current) {
        cameraRef.current.dolly(0.5 * delta[0], false)
      }
    },
    {
      eventOptions: { passive: false },
    }
  )

  const theme = useTheme()

  return (
    <CanvasContainer>
      <Canvas
        shadows
        style={{ background: theme.black, touchAction: 'none' }}
        onMouseMove={(e) => {
          mouseX.set(e.clientX)
          mouseY.set(e.clientY)
        }}
        {...bind()}
      >
        <Stage>
          <MotionConfig transition={transition}>
            <motion.group castShadow initial={false} dispose={null}>
              <Bounds fit clip observe margin={1}>
                {blocks && <Blocks blocks={blocks} />}
              </Bounds>
            </motion.group>
          </MotionConfig>
          <CameraControls ref={cameraRef} />
        </Stage>
      </Canvas>
    </CanvasContainer>
  )
})
