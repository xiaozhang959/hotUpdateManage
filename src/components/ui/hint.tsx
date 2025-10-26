"use client"
import { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'

type Side = 'top' | 'right' | 'bottom' | 'left'

function sideClasses(side: Side) {
  switch (side) {
    case 'top':
      return 'bottom-full left-1/2 -translate-x-1/2 mb-2'
    case 'right':
      return 'left-full top-1/2 -translate-y-1/2 ml-2'
    case 'bottom':
      return 'top-full left-1/2 -translate-x-1/2 mt-2'
    case 'left':
      return 'right-full top-1/2 -translate-y-1/2 mr-2'
  }
}

export function InfoHint({ text, side = 'right' }: { text: string | React.ReactNode; side?: Side }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return
      if (ref.current.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center group cursor-help select-none align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v) } }}
      role="button"
      tabIndex={0}
      aria-label="帮助"
      aria-expanded={open}
    >
      <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-500" />
      <span
        className={`absolute z-50 ${open ? 'block' : 'hidden'} ${sideClasses(side)} max-w-xs rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200`}
      >
        {text}
      </span>
    </span>
  )
}
