"use client"

import React, { useEffect } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Construction } from "lucide-react"
import { toast } from "sonner"

export default function GPACalc() {
  useEffect(() => {
    toast.info("Chức năng đang được phát triển", {
      description: "Chúng tôi đang nỗ lực để hoàn thiện tính năng tính GPA sớm nhất.",
      duration: 3000,
    })
  }, [])

  return (
    <Card className="border-dashed h-[400px] flex items-center justify-center">
      <CardContent className="text-center space-y-4">
        <Construction className="w-16 h-16 mx-auto text-muted-foreground opacity-20" />
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">GPA</h3>
          <p className="text-muted-foreground">Chức năng đang được phát triển...</p>
        </div>
      </CardContent>
    </Card>
  )
}
