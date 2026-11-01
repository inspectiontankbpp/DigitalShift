"use client"

import { useRef, useState, useEffect, ReactNode } from "react"

interface ResponsiveScaleProps {
  children: ReactNode
  baseWidth?: number
  className?: string
}

export function ResponsiveScale({ children, baseWidth = 800, className = "" }: ResponsiveScaleProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    function calcScale() {
      if (!containerRef.current || !innerRef.current) return
      const containerWidth = containerRef.current.offsetWidth
      const innerWidth = innerRef.current.scrollWidth || baseWidth
      if (containerWidth < innerWidth) {
        setScale(containerWidth / innerWidth)
      } else {
        setScale(1)
      }
    }

    calcScale()
    const ro = new ResizeObserver(calcScale)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [baseWidth])

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      <div
        ref={innerRef}
        style={{
          width: `${baseWidth}px`,
          transformOrigin: "top left",
          transform: scale < 1 ? `scale(${scale})` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  )
}
