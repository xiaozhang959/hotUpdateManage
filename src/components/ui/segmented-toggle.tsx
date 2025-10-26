"use client"
import React from 'react'

type SegValue = string

export function SegmentedToggle({
  value,
  onChange,
  left,
  right,
  disableRight = false,
  className = ''
}: {
  value: SegValue
  onChange: (v: SegValue) => void
  left: { value: SegValue; label: React.ReactNode }
  right: { value: SegValue; label: React.ReactNode }
  disableRight?: boolean
  className?: string
}) {
  const isRight = value === right.value
  const warm = '#f54900'
  return (
    <div className={`relative grid grid-cols-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-0.5 ${className}`} role="tablist" aria-label="切换上传方式">
      {/* 动画指示器 */}
      <div
        className={`absolute top-0.5 bottom-0.5 w-1/2 rounded-md shadow transition-transform duration-200 ease-in-out border ${
          isRight ? 'translate-x-full' : 'translate-x-0'
        } bg-[#fff3ed] dark:bg-[#3b241c] border-[color:rgba(245,73,0,0.3)]`}
      />
      {/* 左侧 */}
      <button
        role="tab"
        aria-selected={!isRight}
        className={`z-10 inline-flex items-center justify-center px-3 py-2 text-sm font-medium transition-colors ${
          !isRight ? 'text-[color:#f54900]' : 'text-gray-500'
        }`}
        onClick={() => onChange(left.value)}
        type="button"
      >
        {left.label}
      </button>
      {/* 右侧 */}
      <button
        role="tab"
        aria-selected={isRight}
        disabled={disableRight}
        className={`z-10 inline-flex items-center justify-center px-3 py-2 text-sm font-medium transition-colors ${
          isRight ? 'text-[color:#f54900]' : 'text-gray-500'
        } ${disableRight ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => onChange(right.value)}
        type="button"
      >
        {right.label}
      </button>
    </div>
  )
}
