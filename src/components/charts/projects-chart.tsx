'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Package } from 'lucide-react'

interface ProjectData {
  name: string
  versions: number
  color: string
}

interface ProjectsChartProps {
  data: ProjectData[]
  isLoading?: boolean
}

const COLORS = ['#f97316', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444']

export function ProjectsChart({ data, isLoading }: ProjectsChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">项目版本分布</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <div className="text-muted-foreground">加载中...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const dataWithColors = data.map((item, index) => ({
    ...item,
    color: COLORS[index % COLORS.length]
  }))

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            版本数: {data.versions}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">项目版本分布</CardTitle>
        <Package className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={dataWithColors}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(props: any) => {
                  const percent = props.percent || 0
                  return percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                }}
                outerRadius={60}
                fill="#8884d8"
                dataKey="versions"
              >
                {dataWithColors.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
          {dataWithColors.slice(0, 6).map((item, index) => (
            <div key={index} className="flex items-center">
              <div 
                className="w-2 h-2 rounded-full mr-2" 
                style={{ backgroundColor: item.color }}
              ></div>
              <span className="truncate" title={item.name}>
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}