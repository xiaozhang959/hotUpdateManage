'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Mail } from 'lucide-react'

interface EmailStatsData {
  date: string
  sent: number
  failed: number
}

interface EmailStatsChartProps {
  data: EmailStatsData[]
  isLoading?: boolean
}

export function EmailStatsChart({ data, isLoading }: EmailStatsChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">邮件发送统计</CardTitle>
          <Mail className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <div className="text-muted-foreground">加载中...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">邮件发送统计</CardTitle>
        <Mail className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return `${date.getMonth() + 1}/${date.getDate()}`
                }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                labelFormatter={(value) => {
                  const date = new Date(value)
                  return `${date.getMonth() + 1}月${date.getDate()}日`
                }}
                formatter={(value: number, name: string) => [
                  `${value} 封`,
                  name === 'sent' ? '发送成功' : '发送失败'
                ]}
              />
              <Bar dataKey="sent" fill="#10b981" name="sent" radius={[2, 2, 0, 0]} />
              <Bar dataKey="failed" fill="#ef4444" name="failed" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground mt-2">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            发送成功
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            发送失败
          </div>
        </div>
      </CardContent>
    </Card>
  )
}