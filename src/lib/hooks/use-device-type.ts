"use client"

import { useEffect, useState } from "react"

export type DeviceType = "mobile" | "tablet" | "desktop"

const getDeviceType = (width: number) => {
  if (width < 768) return "mobile"
  if (width < 1024) return "tablet"
  return "desktop"
}

export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>("desktop")

  useEffect(() => {
    const update = () => {
      setDeviceType(getDeviceType(window.innerWidth))
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  return deviceType
}
