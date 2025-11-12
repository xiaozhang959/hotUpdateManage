'use client'

import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package2, Rocket, Shield, Zap, ArrowDown, ArrowRight, Sparkles, Code2 } from 'lucide-react'
import AnimatedStats from '@/components/animated-stats'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'

const fadeInUp = {
  hidden: { opacity: 0, y: 60 },
  visible: { opacity: 1, y: 0 }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3
    }
  }
}

export default function Home() {
  const { scrollYProgress } = useScroll()
  const heroRef = useRef(null)

  const parallaxY = useTransform(scrollYProgress, [0, 1], [0, -100])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

  const features = [
    {
      icon: Package2,
      title: '项目管理',
      description: '轻松创建和管理多个项目，每个项目都有独立的API密钥和版本控制',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Rocket,
      title: '版本发布',
      description: '支持文件上传或URL链接，自动计算MD5，管理更新日志和强制更新策略',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: Shield,
      title: '安全认证',
      description: '基于NextAuth的完整认证系统，支持管理员和用户角色权限控制',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: Zap,
      title: 'API接口',
      description: '提供标准化的RESTful API，轻松集成到您的应用程序中',
      color: 'from-orange-500 to-red-500'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-orange-50/30 to-amber-50/50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-hidden">
      {/* 动态背景 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: 50,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%]"
        >
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-orange-300/20 to-pink-300/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-blue-300/20 to-purple-300/20 rounded-full blur-3xl" />
        </motion.div>
      </div>

      {/* Hero Section */}
      <motion.div 
        ref={heroRef}
        style={{ y: parallaxY }}
        className="relative container mx-auto px-4 pt-20 pb-32"
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          {/* 主标题动画 */}
          <motion.div className="relative inline-block mb-6">
            <motion.div
              animate={{
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                repeatType: "reverse"
              }}
              className="absolute -inset-4 bg-gradient-to-r from-orange-500/20 to-pink-500/20 blur-2xl"
            />
            <h1 className="relative text-6xl lg:text-7xl font-bold">
              <span className="bg-gradient-to-r from-orange-600 via-pink-600 to-purple-600 bg-clip-text text-transparent">
                热更新
              </span>
              <span className="text-gray-900 dark:text-gray-100 ml-2">
                管理系统
              </span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-xl lg:text-2xl text-gray-600 dark:text-gray-400 mb-12 max-w-3xl mx-auto"
          >
            为您的应用程序提供
            <span className="font-semibold text-orange-600 dark:text-orange-400"> 安全、可靠 </span>
            的版本控制和自动更新服务
          </motion.p>

          {/* 按钮组 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
          >
            <Link href="/login">
              <Button 
                size="lg" 
                className="group relative px-8 py-6 text-lg bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 shadow-xl hover:shadow-2xl transition-all duration-300"
              >
                <Sparkles className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                立即开始
              </Button>
            </Link>
            <Link href="/register">
              <Button 
                size="lg" 
                variant="outline"
                className="px-8 py-6 text-lg border-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300"
              >
                创建账号
              </Button>
            </Link>
          </motion.div>

          {/* 下滑提示 */}
          <motion.div
            style={{ opacity }}
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex justify-center"
          >
            <ArrowDown className="w-6 h-6 text-gray-400" />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* 统计数据展示 - 使用新的动画组件 */}
      <AnimatedStats />

      {/* 特性展示区 */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerContainer}
        className="container mx-auto px-4 py-20"
      >
        <motion.h2 
          variants={fadeInUp}
          className="text-4xl font-bold text-center mb-16 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent"
        >
          强大功能，助您轻松管理
        </motion.h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              whileHover={{ 
                y: -10,
                transition: { duration: 0.2 }
              }}
              className="group relative"
            >
              {/* 卡片背景光效 */}
              <div className={`absolute inset-0 bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-300`} />
              
              <Card className="relative h-full border-2 border-gray-100 dark:border-gray-800 hover:border-orange-200 dark:hover:border-orange-800 transition-all duration-300 overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${feature.color}`} />
                
                <CardHeader>
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.5 }}
                    className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.color} shadow-lg mb-4`}
                  >
                    <feature.icon className="h-8 w-8 text-white" />
                  </motion.div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

          {/* 代码示例区 */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="container mx-auto px-4 py-20"
          >
            <Card className="max-w-5xl mx-auto border-2 border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-pink-500 p-1">
                <div className="bg-white dark:bg-gray-900 p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <CardTitle className="text-3xl mb-2">快速集成</CardTitle>
                      <CardDescription className="text-lg">
                        只需简单的API调用即可实现版本检测和自动更新
                        <Link href="/docs/api" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-700 ml-2 inline-flex items-center gap-1">
                          查看更多文档
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </CardDescription>
                    </div>
                    <Code2 className="h-12 w-12 text-orange-500" />
                  </div>
              
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="bg-gray-900 dark:bg-gray-950 p-6 rounded-xl shadow-inner"
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="ml-2 text-gray-400 text-sm">api_example.js</span>
                </div>
                
                <code className="text-sm block space-y-2">
                  <div className="text-green-400">
                    <span className="text-purple-400">POST</span> /api/versions/latest
                  </div>
                  <div className="text-gray-400">
                    <span className="text-blue-400">Headers:</span> X-API-Key: your-project-key
                  </div>
                  <div className="mt-4 text-gray-400">Response:</div>
                  <div className="pl-4 space-y-1">
                    <div className="text-gray-500">{'{'}</div>
                    <div className="text-gray-300 pl-4">
                      <span className="text-blue-400">&quot;success&quot;</span>: <span className="text-orange-400">true</span>,
                    </div>
                    <div className="text-gray-300 pl-4">
                      <span className="text-blue-400">&quot;data&quot;</span>: {'{'}
                    </div>
                    <div className="text-gray-300 pl-8">
                      <span className="text-blue-400">&quot;version&quot;</span>: <span className="text-yellow-400">&quot;1.0.x&quot;</span>,
                    </div>
                    <div className="text-gray-300 pl-8">
                      <span className="text-blue-400">&quot;downloadUrl&quot;</span>: <span className="text-yellow-400">&quot;/api/versions/&#123;versionId&#125;/download?i=0&quot;</span>,
                    </div>
                    <div className="text-gray-300 pl-8">
                      <span className="text-blue-400">&quot;md5&quot;</span>: <span className="text-yellow-400">&quot;0123456789abcdef0123456789abcdef&quot;</span>,
                    </div>
                    <div className="text-gray-300 pl-8">
                      <span className="text-blue-400">&quot;size&quot;</span>: <span className="text-orange-400">123456</span>,
                    </div>
                    <div className="text-gray-300 pl-8">
                      <span className="text-blue-400">&quot;forceUpdate&quot;</span>: <span className="text-orange-400">false</span>,
                    </div>
                    <div className="text-gray-300 pl-8">
                      <span className="text-blue-400">&quot;changelog&quot;</span>: <span className="text-yellow-400">&quot;&quot;</span>,
                    </div>
                    <div className="text-gray-300 pl-8">
                      <span className="text-blue-400">&quot;createdAt&quot;</span>: <span className="text-yellow-400">&quot;2025-11-12T00:00:00.000Z&quot;</span>,
                    </div>
                    <div className="text-gray-300 pl-8">
                      <span className="text-blue-400">&quot;updatedAt&quot;</span>: <span className="text-yellow-400">&quot;2025-11-12T00:00:00.000Z&quot;</span>,
                    </div>
                    <div className="text-gray-300 pl-8">
                      <span className="text-blue-400">&quot;timestamp&quot;</span>: <span className="text-orange-400">1762954467000</span>,
                    </div>
                    <div className="text-gray-300 pl-8">
                      <span className="text-blue-400">&quot;isCurrent&quot;</span>: <span className="text-orange-400">true</span>
                    </div>
                    <div className="text-gray-300 pl-4">{'}'}</div>
                    <div className="text-gray-500">{'}'}</div>
                  </div>
                </code>
              </motion.div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* 底部CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="container mx-auto px-4 py-20 text-center"
      >
        <motion.h2 
          initial={{ scale: 0.9 }}
          whileInView={{ scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-4xl font-bold mb-8 bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent"
        >
          准备好开始了吗？
        </motion.h2>
        <Link href="/register">
          <Button
            size="lg"
            className="px-12 py-6 text-lg bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105"
          >
            <Rocket className="w-5 h-5 mr-2" />
            免费开始使用
          </Button>
        </Link>
      </motion.div>
    </div>
  )
}
