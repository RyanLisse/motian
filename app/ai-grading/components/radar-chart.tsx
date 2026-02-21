"use client"

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts"

interface AssessmentRadarProps {
  data: {
    subject: string
    A: number
    fullMark: number
  }[]
}

export function AssessmentRadar({ data }: AssessmentRadarProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid gridType="polygon" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: '#888888', fontSize: 11 }} />
        <Radar
          name="Candidate"
          dataKey="A"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="#3b82f6"
          fillOpacity={0.2}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
