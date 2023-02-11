/* eslint-disable */
import React, { forwardRef, ForwardedRef, MutableRefObject, useEffect, useRef } from 'react'
import {
  MOUSE,
  Vector2,
  Vector3,
  Vector4,
  Quaternion,
  Matrix4,
  Spherical,
  Box3,
  Sphere,
  Raycaster,
  MathUtils,
} from 'three'
import { ReactThreeFiber, extend, useFrame, useThree } from '@react-three/fiber'
import CameraControlsDefault from 'camera-controls'
import { usePinch } from '@use-gesture/react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      cameraControlsDefault: ReactThreeFiber.Node<CameraControlsDefault, typeof CameraControlsDefault>
    }
  }
}

const subsetOfTHREE = {
  MOUSE: MOUSE,
  Vector2: Vector2,
  Vector3: Vector3,
  Vector4: Vector4,
  Quaternion: Quaternion,
  Matrix4: Matrix4,
  Spherical: Spherical,
  Box3: Box3,
  Sphere: Sphere,
  Raycaster: Raycaster,
  MathUtils: {
    DEG2RAD: MathUtils.DEG2RAD,
    clamp: MathUtils.clamp,
  },
}

CameraControlsDefault.install({ THREE: subsetOfTHREE })
extend({ CameraControlsDefault })

export const CameraControls = forwardRef<CameraControlsDefault, unknown>((_, ref) => {
  const cameraControls = useRef<CameraControlsDefault | null>(null)
  useEffect(() => {
    if (cameraControls.current) {
      cameraControls.current.mouseButtons.wheel = CameraControlsDefault.ACTION.TRUCK
      cameraControls.current.mouseButtons
      cameraControls.current.maxDistance = 8
      cameraControls.current.minDistance = 0.5
      cameraControls.current.minPolarAngle = Math.PI / 2
      cameraControls.current.maxPolarAngle = Math.PI / 2
      cameraControls.current.minAzimuthAngle = 0
      cameraControls.current.maxAzimuthAngle = 0
      cameraControls.current.dollySpeed = 2.5
      cameraControls.current.truckSpeed = 2.5
      cameraControls.current.dampingFactor = 2.5
      cameraControls.current.draggingDampingFactor = 2.5
    }
  }, [cameraControls])

  const bind = usePinch(({ down, movement: [mx, my] }) => {
    if (cameraControls.current) {
      if (down) {
        cameraControls.current.truck(mx * 0.1, my * 0.1)
      } else {
        cameraControls.current.truck(0, 0)
      }
    }
  })

  const camera = useThree((state) => state.camera)
  const renderer = useThree((state) => state.gl)
  useFrame((_, delta) => cameraControls.current?.update(delta))
  useEffect(() => () => cameraControls.current?.dispose(), [])
  return (
    <cameraControlsDefault
      {...bind()}
      ref={mergeRefs<CameraControlsDefault>(cameraControls, ref)}
      args={[camera, renderer.domElement]}
    />
  )
})

export type CameraControls = CameraControlsDefault

function mergeRefs<T>(...refs: (MutableRefObject<T> | ForwardedRef<T>)[]) {
  return (instance: T): void => {
    for (const ref of refs) {
      if (typeof ref === 'function') {
        ref(instance)
      } else if (ref) {
        ref.current = instance
      }
    }
  }
}
