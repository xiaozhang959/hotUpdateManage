'use client'

import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring, useInView } from 'framer-motion'
import { Users, FolderOpen, TrendingUp } from 'lucide-react'
import { useRef } from 'react'

interface Stats {
  totalUsers: number
  totalProjects: number
}

function AnimatedCounter({ value, duration = 2 }: { value: number; duration?: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const motionValue = useMotionValue(0)
  const springValue = useSpring(motionValue, { duration: duration * 1000 })
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (isInView) {
      motionValue.set(value)
    }
  }, [isInView, value, motionValue])

  useEffect(() => {
    springValue.on('change', (latest) => {
      setDisplayValue(Math.round(latest))
    })
  }, [springValue])

  return <span ref={ref}>{displayValue.toLocaleString()}</span>
}

export default function AnimatedStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/public/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('获取统计数据失败:', error)
      setStats({ totalUsers: 0, totalProjects: 0 })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="relative w-full py-20">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-yellow-500/10 blur-3xl" />
        <div className="relative flex flex-col md:flex-row gap-8 justify-center items-center">
          <div className="animate-pulse">
            <div className="h-32 w-64 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
          </div>
          <div className="animate-pulse">
            <div className="h-32 w-64 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  const statsData = [
    {
      icon: Users,
      value: stats?.totalUsers || 0,
      label: '已注册用户',
      gradient: 'from-blue-500 to-cyan-500',
      delay: 0.2
    },
    {
      icon: FolderOpen,
      value: stats?.totalProjects || 0,
      label: '累计项目',
      gradient: 'from-orange-500 to-pink-500',
      delay: 0.4
    }
  ]

  return (
    <div className="relative w-full py-20 overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0">
        <div className="absolute top-0 -left-1/4 w-96 h-96 bg-orange-300 opacity-20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 -right-1/4 w-96 h-96 bg-amber-300 opacity-20 rounded-full blur-3xl animate-pulse" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative"
      >
        <div className="flex flex-col md:flex-row gap-8 justify-center items-center">
          {statsData.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: stat.delay, duration: 0.5, type: "spring" }}
              whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
              className="relative group"
            >
              {/* 光晕效果 */}
              <div className={`absolute inset-0 bg-gradient-to-r ${stat.gradient} opacity-20 blur-2xl group-hover:opacity-30 transition-opacity duration-300`} />
              
              {/* 主卡片 */}
              <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-8 border border-gray-200/50 dark:border-gray-700/50 shadow-2xl">
                <div className="flex items-center gap-6">
                  {/* 图标容器 */}
                  <motion.div
                    animate={{ 
                      rotate: [0, 10, -10, 0],
                    }}
                    transition={{ 
                      duration: 4,
                      repeat: Infinity,
                      repeatType: "reverse"
                    }}
                    className={`relative p-4 rounded-2xl bg-gradient-to-br ${stat.gradient} shadow-lg`}
                  >
                    <stat.icon className="h-8 w-8 text-white" />
                    
                    {/* 动态光点 */}
                    <motion.div
                      className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full"
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 1, 0.5]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity
                      }}
                    />
                  </motion.div>

                  {/* 数据展示 */}
                  <div className="flex flex-col">
                    <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
                      <AnimatedCounter value={stat.value} />
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: stat.delay + 0.5 }}
                        className="text-2xl ml-1"
                      >
                        +
                      </motion.span>
                    </div>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: stat.delay + 0.3 }}
                      className="text-gray-600 dark:text-gray-400 font-medium mt-2"
                    >
                      {stat.label}
                    </motion.p>
                  </div>
                </div>

                {/* 趋势指示器 */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: stat.delay + 0.6 }}
                  className="mt-4 flex items-center gap-2"
                >
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500 font-medium">持续增长中</span>
                </motion.div>

                {/* 活跃指示器 */}
                <div className="absolute top-3 right-3">
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                    }}
                    className="flex items-center gap-1"
                  >
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-xs text-green-500">活跃</span>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 底部装饰线 */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="mt-12 h-1 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent max-w-md mx-auto"
        />
      </motion.div>
    </div>
  )
}