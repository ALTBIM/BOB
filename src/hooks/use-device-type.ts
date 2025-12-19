import * as React from "react"

export type DeviceType = "mobile" | "tablet" | "desktop"

const MOBILE_MAX_WIDTH = 639
const TABLET_MAX_WIDTH = 1023

function getDeviceType(width: number): DeviceType {
  if (width <= MOBILE_MAX_WIDTH) return "mobile"
  if (width <= TABLET_MAX_WIDTH) return "tablet"
  return "desktop"
}

export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = React.useState<DeviceType>("desktop")

  React.useEffect(() => {
    const updateDeviceType = () => {
      setDeviceType(getDeviceType(window.innerWidth))
    }

    updateDeviceType()
    window.addEventListener("resize", updateDeviceType)
    window.addEventListener("orientationchange", updateDeviceType)

    return () => {
      window.removeEventListener("resize", updateDeviceType)
      window.removeEventListener("orientationchange", updateDeviceType)
    }
  }, [])

  return deviceType
}
