// input:  [browser viewport width, `(max-width: 639px)` media-query change events]
// output: [boolean `useIsMobile()` hook result]
// pos:    [Simple responsive helper consumed by landing and adaptive UI branches]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import * as React from "react"

const MOBILE_BREAKPOINT = 640

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(() => {
    if (typeof window === "undefined") return undefined
    return window.innerWidth < MOBILE_BREAKPOINT
  })

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(mql.matches)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
