'use client'

import React, { useCallback, useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { 
  Upload, 
  X, 
  FileIcon, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  File,
  FileText,
  FileCode,
  Archive,
  Image
} from 'lucide-react'
import { Button } from './button'
import { Badge } from './badge'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  onFileRemove?: () => void
  selectedFile?: File | null
  accept?: string
  maxSize?: number // in bytes
  uploading?: boolean
  className?: string
  disabled?: boolean
}

export function FileUpload({
  onFileSelect,
  onFileRemove,
  selectedFile,
  accept,
  maxSize = 100 * 1024 * 1024, // 100MB default
  uploading = false,
  className,
  disabled = false
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // 根据文件扩展名获取图标
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext || '')) {
      return <Image className="h-5 w-5" />
    }
    if (['zip', 'rar', '7z', 'tar', 'gz', 'apk', 'ipa', 'aab'].includes(ext || '')) {
      return <Archive className="h-5 w-5" />
    }
    if (['js', 'ts', 'jsx', 'tsx', 'json', 'xml', 'html', 'css'].includes(ext || '')) {
      return <FileCode className="h-5 w-5" />
    }
    if (['txt', 'md', 'doc', 'docx', 'pdf'].includes(ext || '')) {
      return <FileText className="h-5 w-5" />
    }
    return <File className="h-5 w-5" />
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 验证文件
  const validateFile = (file: File): boolean => {
    setError(null)
    
    if (maxSize && file.size > maxSize) {
      setError(`文件大小不能超过 ${formatFileSize(maxSize)}`)
      return false
    }
    
    return true
  }

  // 处理文件选择
  const handleFile = useCallback((file: File) => {
    if (validateFile(file)) {
      onFileSelect(file)
      setError(null)
    }
  }, [onFileSelect, maxSize])

  // 拖放事件处理
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled || uploading) return
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [disabled, uploading])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled || uploading) return
    
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [handleFile, disabled, uploading])

  // 点击上传
  const handleClick = () => {
    if (!disabled && !uploading) {
      inputRef.current?.click()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  // 粘贴事件处理
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled || uploading) return
      
      // 检查是否在上传区域内
      if (dropZoneRef.current && dropZoneRef.current.contains(document.activeElement)) {
        e.preventDefault()
        const items = e.clipboardData?.items
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1 || items[i].kind === 'file') {
              const file = items[i].getAsFile()
              if (file) {
                handleFile(file)
                break
              }
            }
          }
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('paste', handlePaste)
    }
  }, [handleFile, disabled, uploading])

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={dropZoneRef}
        className={cn(
          "relative border-2 border-dashed rounded-lg transition-all duration-200",
          dragActive ? "border-orange-500 bg-orange-50 dark:bg-orange-900/10" : "border-gray-300 dark:border-gray-700",
          disabled || uploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-orange-400",
          error ? "border-red-500" : "",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-orange-500 focus-within:ring-offset-2"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          disabled={disabled || uploading}
        />

        {selectedFile ? (
          // 已选择文件的显示
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1">
                <div className={cn(
                  "p-2 rounded-lg",
                  uploading ? "bg-orange-100 dark:bg-orange-900/20" : "bg-gray-100 dark:bg-gray-800"
                )}>
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                  ) : (
                    <div className="text-gray-600 dark:text-gray-400">
                      {getFileIcon(selectedFile.name)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
              {!uploading && onFileRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    onFileRemove()
                    setError(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {uploading && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-500">上传中...</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                  <div className="bg-orange-600 h-1.5 rounded-full animate-pulse" style={{ width: '70%' }}></div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // 未选择文件的显示
          <div className="p-8 text-center">
            <div className={cn(
              "mx-auto h-12 w-12 rounded-lg flex items-center justify-center",
              dragActive ? "bg-orange-100 dark:bg-orange-900/20" : "bg-gray-100 dark:bg-gray-800"
            )}>
              <Upload className={cn(
                "h-6 w-6",
                dragActive ? "text-orange-600" : "text-gray-400"
              )} />
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {dragActive ? '释放以上传文件' : '点击或拖放文件到此处'}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                也可以使用 Ctrl+V 粘贴文件
              </p>
              {maxSize && (
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  最大文件大小: {formatFileSize(maxSize)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 flex items-center space-x-1 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

// 简化版本的小型文件选择器（用于表单内）
export function SimpleFileUpload({
  onFileSelect,
  selectedFile,
  accept,
  maxSize = 100 * 1024 * 1024,
  uploading = false,
  disabled = false
}: FileUploadProps) {
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    const file = e.target.files?.[0]
    if (file) {
      if (maxSize && file.size > maxSize) {
        setError(`文件大小不能超过 ${formatFileSize(maxSize)}`)
        return
      }
      setError(null)
      onFileSelect(file)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              上传中...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              选择文件
            </>
          )}
        </Button>
        {selectedFile && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </Badge>
            {!uploading && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  onFileSelect(null as any)
                  if (inputRef.current) inputRef.current.value = ''
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          disabled={disabled || uploading}
        />
      </div>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}