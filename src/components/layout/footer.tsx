import { Github, Mail } from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t bg-white/80 dark:bg-gray-900/80 backdrop-blur">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          {/* 项目信息 */}
          <div className="space-y-2">
            <h3 className="font-bold text-lg">热更新管理系统</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
              为您的应用程序提供安全、可靠的版本控制和自动更新服务
            </p>
          </div>

          {/* 开发者信息 */}
          <div className="flex items-center gap-4 text-sm">
            <a 
              href="https://github.com/xiaozhang959/hotUpdateManage" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 transition-colors"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
            <a 
              href="mailto:98study@duck.com"
              className="flex items-center gap-2 text-gray-600 hover:text-orange-600 dark:text-gray-400 dark:hover:text-orange-400 transition-colors"
            >
              <Mail className="h-4 w-4" />
              联系我们
            </a>
          </div>
        </div>

        {/* 版权信息 */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <p>© {currentYear} 热更新管理系统. All rights reserved.</p>
            <p>Version 1.0.0</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
