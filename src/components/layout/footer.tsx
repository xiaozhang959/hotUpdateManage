import Link from 'next/link'
import { Github, Mail, Heart } from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t bg-white/80 dark:bg-gray-900/80 backdrop-blur">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* 品牌信息 */}
          <div className="space-y-3">
            <h3 className="font-bold text-lg">热更新管理系统</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              为您的应用程序提供安全、可靠的版本控制和自动更新服务
            </p>
          </div>

          {/* 快速链接 */}
          <div className="space-y-3">
            <h4 className="font-semibold">快速链接</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/dashboard" className="text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400">
                  仪表板
                </Link>
              </li>
              <li>
                <Link href="/projects" className="text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400">
                  项目管理
                </Link>
              </li>
              <li>
                <Link href="/docs" className="text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400">
                  API文档
                </Link>
              </li>
              <li>
                <Link href="/profile" className="text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400">
                  个人设置
                </Link>
              </li>
            </ul>
          </div>

          {/* 开发者信息 */}
          <div className="space-y-3">
            <h4 className="font-semibold">开发者</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a 
                  href="https://github.com/yourusername/hot-update-manager" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </a>
              </li>
              <li>
                <a 
                  href="mailto:support@example.com"
                  className="flex items-center gap-2 text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400"
                >
                  <Mail className="h-4 w-4" />
                  support@example.com
                </a>
              </li>
            </ul>
          </div>

          {/* 技术栈 */}
          <div className="space-y-3">
            <h4 className="font-semibold">技术栈</h4>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded">Next.js 15</span>
              <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded">TypeScript</span>
              <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded">Tailwind CSS</span>
              <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded">Prisma</span>
              <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded">NextAuth</span>
            </div>
          </div>
        </div>

        {/* 版权信息 */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <p>© {currentYear} 热更新管理系统. All rights reserved.</p>
            <p className="flex items-center gap-1">
              Made with <Heart className="h-3 w-3 text-red-500 fill-current" /> using Next.js
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}