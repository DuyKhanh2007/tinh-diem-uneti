"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { RainbowButton } from "@/components/ui/rainbow-button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Calendar as CalendarIcon, 
  Search, 
  User, 
  GraduationCap, 
  CalendarDays,
  Download,
  RefreshCw,
  BookOpen,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  FileSpreadsheet,
  FileText,
  Zap,
  CalendarRange,
  Table as TableIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  AlignmentType, 
  WidthType 
} from 'docx'
import { createClientShieldToken } from "@/lib/shield"

export interface ScheduleItem {
  NamHoc?: number
  TenDot?: string
  MaLopHocPhan?: string
  TenMonHoc?: string
  TenLopHoc?: string
  TuTiet?: number
  DenTiet?: number
  TenPhong?: string
  TenGiangVien?: string
  CaHoc?: string
  NgayBatDau?: string
  NgayKetThuc?: string
  Thu?: number
}

export interface StudentScheduleData {
  hoTen?: string
  ten?: string
  donVi?: string
  body: ScheduleItem[]
}

// UNETI Official Period Timetable (Tiết -> Thời gian)
const PERIOD_TIMES: { [key: number]: { start: string; end: string } } = {
  1: { start: "07:00", end: "07:45" },
  2: { start: "07:50", end: "08:35" },
  3: { start: "08:40", end: "09:25" },
  4: { start: "09:35", end: "10:20" },
  5: { start: "10:25", end: "11:10" },
  6: { start: "11:15", end: "12:00" },
  7: { start: "13:00", end: "13:45" },
  8: { start: "13:50", end: "14:35" },
  9: { start: "14:40", end: "15:25" },
  10: { start: "15:35", end: "16:20" },
  11: { start: "16:25", end: "17:10" },
  12: { start: "17:15", end: "18:00" },
  13: { start: "18:15", end: "19:00" },
  14: { start: "19:05", end: "19:50" },
  15: { start: "19:55", end: "20:40" },
}

// Check if an item is an Exam accurately without false positives
const checkIsExam = (item: ScheduleItem): boolean => {
  const name = (item.TenMonHoc || "").trim().toLowerCase()
  const dot = (item.TenDot || "").trim().toLowerCase()
  const phong = (item.TenPhong || "").trim().toLowerCase()

  const words = name.split(/[\s,.-]+/)
  const hasThiWord = words.includes('thi') || words.includes('kthp') || name.startsWith('thi ') || name.endsWith(' thi')
  const isExamDot = dot.includes('lịch thi') || dot.includes('thi kết thúc') || dot.includes('thi kthp')
  const isExamRoom = phong.includes('phòng thi') || phong.includes('p.thi')

  return hasThiWord || isExamDot || isExamRoom
}

// Clean room string (strip "Phòng học/" prefix for compact mobile view)
const cleanRoomName = (room?: string): string => {
  if (!room) return "Chưa xếp phòng"
  return room.replace(/^(phòng\s*học|phong\s*hoc|p\.)\s*[\/:\s]*/gi, "").trim() || room
}

export default function ScheduleViewer() {
  const [studentId, setStudentId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<StudentScheduleData | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // Live real-time clock
  const [now, setNow] = useState<Date>(new Date())

  // View modes: 'today' is FIRST before 'week', 'month', 'list'
  const [viewMode, setViewMode] = useState<'today' | 'week' | 'month' | 'list'>('today')
  
  // Selected date for schedule navigation (defaults to today)
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  
  // Filter by semester/dot and search text
  const [selectedSemester, setSelectedSemester] = useState<string>("all")
  const [filterSearch, setFilterSearch] = useState<string>("")

  // Real-time clock ticking
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("uneti_recent_msv")
      if (saved) {
        setRecentSearches(JSON.parse(saved))
      }
    } catch (_) {}
  }, [])

  const saveRecentSearch = (msv: string) => {
    try {
      const updated = [msv, ...recentSearches.filter(item => item !== msv)].slice(0, 5)
      setRecentSearches(updated)
      localStorage.setItem("uneti_recent_msv", JSON.stringify(updated))
    } catch (_) {}
  }

  const removeRecentSearch = (msv: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const updated = recentSearches.filter(item => item !== msv)
      setRecentSearches(updated)
      localStorage.setItem("uneti_recent_msv", JSON.stringify(updated))
    } catch (_) {}
  }

  // Fetch schedule from protected API
  const handleFetchSchedule = async (idToFetch?: string) => {
    const targetId = (idToFetch || studentId).trim()
    if (!targetId) {
      toast.error("Vui lòng nhập mã sinh viên")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Generate dynamic encrypted shield token in browser
      const shieldToken = await createClientShieldToken(targetId)

      // Call protected Next.js API route with encrypted shield token header
      const response = await fetch(`/api/schedule?id=${encodeURIComponent(targetId)}`, {
        headers: {
          "X-Shield-Token": shieldToken
        }
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.reason || errData.error || `Lỗi kết nối máy chủ (${response.status})`)
      }
      
      const resJson: StudentScheduleData = await response.json()
      
      if (!resJson || !Array.isArray(resJson.body)) {
        throw new Error("Không thể tải dữ liệu lịch học hoặc dữ liệu không hợp lệ")
      }

      setData(resJson)
      saveRecentSearch(targetId)

      // Auto-set current date to today (or closest available date if today has no classes in data)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayKey = formatDateKey(today)

      let hasToday = false
      for (const item of resJson.body) {
        if (item.NgayBatDau && item.NgayBatDau.split("T")[0] === todayKey) {
          hasToday = true
          break
        }
      }

      if (hasToday) {
        setCurrentDate(new Date())
        setViewMode('today')
      } else if (resJson.body.length > 0) {
        let nearestDate: Date | null = null
        let minDiff = Infinity

        for (const item of resJson.body) {
          if (item.NgayBatDau) {
            const itemDate = new Date(item.NgayBatDau)
            itemDate.setHours(0, 0, 0, 0)
            const diff = Math.abs(itemDate.getTime() - today.getTime())
            if (diff < minDiff) {
              minDiff = diff
              nearestDate = itemDate
            }
          }
        }

        if (nearestDate && Math.abs(nearestDate.getTime() - today.getTime()) > 30 * 24 * 3600 * 1000) {
          setCurrentDate(nearestDate)
        } else {
          setCurrentDate(new Date())
        }
      }

      toast.success(`Đã tải ${resJson.body.length} buổi học của SV ${resJson.hoTen || targetId}`)

    } catch (err: any) {
      console.error(err)
      setError(err.message || "Không thể tải lịch học. Vui lòng thử lại sau.")
      toast.error(err.message || "Lỗi tải lịch học")
    } finally {
      setLoading(false)
    }
  }

  // Helper date functions
  const formatDateKey = (d: Date): string => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getDayNameVN = (dayIndex: number): string => {
    const days = ["Chủ Nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"]
    return days[dayIndex] || ""
  }

  const getDayNameShortVN = (dayIndex: number): string => {
    const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
    return days[dayIndex] || ""
  }

  const getWeekNumber = (d: Date): number => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const dayNum = date.getUTCDay() || 7
    date.setUTCDate(date.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }

  const getTimeForPeriod = (tuTiet?: number, denTiet?: number): string | null => {
    if (!tuTiet || !denTiet) return null
    const startObj = PERIOD_TIMES[tuTiet]
    const endObj = PERIOD_TIMES[denTiet]
    if (startObj && endObj) {
      return `${startObj.start} - ${endObj.end}`
    }
    return null
  }

  // Get distinct semesters / dots
  const semesters = useMemo(() => {
    if (!data?.body) return []
    const set = new Set<string>()
    data.body.forEach(item => {
      if (item.TenDot) set.add(item.TenDot)
    })
    return Array.from(set)
  }, [data])

  // Filtered schedule list
  const filteredSchedule = useMemo(() => {
    if (!data?.body) return []
    return data.body.filter(item => {
      if (selectedSemester !== "all" && item.TenDot !== selectedSemester) {
        return false
      }
      if (filterSearch.trim()) {
        const query = filterSearch.toLowerCase().trim()
        const matchSubject = (item.TenMonHoc || "").toLowerCase().includes(query)
        const matchRoom = (item.TenPhong || "").toLowerCase().includes(query)
        const matchTeacher = (item.TenGiangVien || "").toLowerCase().includes(query)
        const matchClass = (item.TenLopHoc || "").toLowerCase().includes(query)
        if (!matchSubject && !matchRoom && !matchTeacher && !matchClass) {
          return false
        }
      }
      return true
    })
  }, [data, selectedSemester, filterSearch])

  // Group filtered schedule by date string YYYY-MM-DD
  const scheduleByDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>()
    filteredSchedule.forEach(item => {
      if (!item.NgayBatDau) return
      const dateKey = item.NgayBatDau.split("T")[0]
      if (!map.has(dateKey)) {
        map.set(dateKey, [])
      }
      map.get(dateKey)!.push(item)
    })

    // Sort items within each day by TuTiet
    map.forEach((items) => {
      items.sort((a, b) => (a.TuTiet || 0) - (b.TuTiet || 0))
    })

    return map
  }, [filteredSchedule])

  // Get today's classes
  const todayClasses = useMemo(() => {
    const todayKey = formatDateKey(now)
    return scheduleByDate.get(todayKey) || []
  }, [scheduleByDate, now])

  // Calculate live status for a class
  const getLiveClassStatus = (item: ScheduleItem): { status: 'active' | 'upcoming' | 'past'; label: string } | null => {
    if (!item.NgayBatDau || !item.TuTiet || !item.DenTiet) return null
    const dateKey = item.NgayBatDau.split("T")[0]
    const todayKey = formatDateKey(now)
    if (dateKey !== todayKey) return null

    const startTimeStr = PERIOD_TIMES[item.TuTiet]?.start
    const endTimeStr = PERIOD_TIMES[item.DenTiet]?.end
    if (!startTimeStr || !endTimeStr) return null

    const [sH, sM] = startTimeStr.split(":").map(Number)
    const [eH, eM] = endTimeStr.split(":").map(Number)

    const classStart = new Date(now)
    classStart.setHours(sH, sM, 0, 0)

    const classEnd = new Date(now)
    classEnd.setHours(eH, eM, 0, 0)

    if (now >= classStart && now <= classEnd) {
      return { status: 'active', label: 'Đang diễn ra' }
    } else if (now < classStart) {
      const diffMin = Math.round((classStart.getTime() - now.getTime()) / 60000)
      if (diffMin <= 60) {
        return { status: 'upcoming', label: `Bắt đầu sau ${diffMin}p` }
      }
      return { status: 'upcoming', label: 'Sắp diễn ra' }
    } else {
      return { status: 'past', label: 'Đã hoàn thành' }
    }
  }

  // Navigation handlers
  const handlePrev = () => {
    const d = new Date(currentDate)
    if (viewMode === 'today') {
      d.setDate(d.getDate() - 1)
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() - 7)
    } else if (viewMode === 'month') {
      d.setMonth(d.getMonth() - 1)
    }
    setCurrentDate(d)
  }

  const handleNext = () => {
    const d = new Date(currentDate)
    if (viewMode === 'today') {
      d.setDate(d.getDate() + 1)
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() + 7)
    } else if (viewMode === 'month') {
      d.setMonth(d.getMonth() + 1)
    }
    setCurrentDate(d)
  }

  const handleToday = () => {
    setCurrentDate(new Date())
    setViewMode('today')
  }

  // Generate 7 days of the current week (Monday to Sunday)
  const weekDays = useMemo(() => {
    const d = new Date(currentDate)
    const currentDayOfWeek = d.getDay() // 0 is Sunday, 1 is Monday
    const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek
    
    const monday = new Date(d)
    monday.setDate(d.getDate() + distanceToMonday)
    monday.setHours(0, 0, 0, 0)

    const days = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday)
      day.setDate(monday.getDate() + i)
      const dateKey = formatDateKey(day)
      const isToday = dateKey === formatDateKey(now)
      const isSelected = dateKey === formatDateKey(currentDate)
      const classes = scheduleByDate.get(dateKey) || []
      
      days.push({
        date: day,
        dateKey,
        dayName: getDayNameVN(day.getDay()),
        dayNameShort: getDayNameShortVN(day.getDay()),
        dayNum: String(day.getDate()).padStart(2, '0'),
        isToday,
        isSelected,
        hasClasses: classes.length > 0,
        classCount: classes.length,
        isWeekend: day.getDay() === 0 || day.getDay() === 6
      })
    }
    return days
  }, [currentDate, now, scheduleByDate])

  // Generate Month Grid Matrix
  const monthMatrix = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    // Day of week for 1st day (1=Mon, ..., 7=Sun)
    let firstDayIndex = firstDay.getDay()
    firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1

    const matrix: ({
      date: Date
      dateKey: string
      dayNum: number
      isCurrentMonth: boolean
      isToday: boolean
      isSelected: boolean
      hasClasses: boolean
      classCount: number
      isWeekend: boolean
    } | null)[] = []

    // Empty padding slots
    for (let i = 0; i < firstDayIndex; i++) {
      matrix.push(null)
    }

    // Days of this month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d)
      const dateKey = formatDateKey(date)
      const isToday = dateKey === formatDateKey(now)
      const isSelected = dateKey === formatDateKey(currentDate)
      const classes = scheduleByDate.get(dateKey) || []

      matrix.push({
        date,
        dateKey,
        dayNum: d,
        isCurrentMonth: true,
        isToday,
        isSelected,
        hasClasses: classes.length > 0,
        classCount: classes.length,
        isWeekend: date.getDay() === 0 || date.getDay() === 6
      })
    }

    return matrix
  }, [currentDate, now, scheduleByDate])

  // Next upcoming class summary
  const nextUpcomingClass = useMemo(() => {
    const todayKey = formatDateKey(now)
    const classesToday = scheduleByDate.get(todayKey) || []
    
    for (const item of classesToday) {
      if (!item.TuTiet) continue
      const startObj = PERIOD_TIMES[item.TuTiet]
      if (startObj) {
        const [h, m] = startObj.start.split(":").map(Number)
        const classStart = new Date(now)
        classStart.setHours(h, m, 0, 0)
        if (classStart > now) {
          return { item, time: startObj.start }
        }
      }
    }
    return null
  }, [scheduleByDate, now])

  // Export to Excel
  const handleExportExcel = () => {
    if (!filteredSchedule.length) {
      toast.error("Không có lịch học để xuất")
      return
    }

    const exportRows = filteredSchedule.map((item, idx) => ({
      "STT": idx + 1,
      "Mã Lớp HP": item.MaLopHocPhan || "",
      "Tên Môn Học": item.TenMonHoc || "",
      "Lớp Học": item.TenLopHoc || "",
      "Đợt / Học Kỳ": item.TenDot || "",
      "Thứ": item.NgayBatDau ? getDayNameVN(new Date(item.NgayBatDau).getDay()) : "",
      "Ngày Học": item.NgayBatDau ? item.NgayBatDau.split("T")[0] : "",
      "Từ Tiết": item.TuTiet || "",
      "Đến Tiết": item.DenTiet || "",
      "Thời Gian": getTimeForPeriod(item.TuTiet, item.DenTiet) || "",
      "Phòng Học": item.TenPhong || "",
      "Giảng Viên": item.TenGiangVien || "",
      "Ca Học": item.CaHoc || "",
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "ThoiKhoaBieu")
    XLSX.writeFile(workbook, `LichHoc_UNETI_${data?.hoTen || studentId || 'SV'}.xlsx`)
    toast.success("Đã xuất file Excel thành công!")
  }

  // Export to Word (.docx)
  const handleExportWord = async () => {
    if (!filteredSchedule.length) {
      toast.error("Không có lịch học để xuất")
      return
    }

    const tableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "STT", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Ngày / Thứ", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Môn học", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Tiết / Giờ", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Phòng", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Giảng viên", bold: true })] })] }),
        ]
      })
    ]

    filteredSchedule.forEach((item, index) => {
      const dateStr = item.NgayBatDau ? item.NgayBatDau.split("T")[0] : "-"
      const d = item.NgayBatDau ? new Date(item.NgayBatDau) : null
      const thuStr = d ? getDayNameShortVN(d.getDay()) : "-"
      const timeStr = getTimeForPeriod(item.TuTiet, item.DenTiet) || ""

      tableRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(String(index + 1))] }),
            new TableCell({ children: [new Paragraph(`${thuStr}, ${dateStr}`)] }),
            new TableCell({ children: [new Paragraph(item.TenMonHoc || "-")] }),
            new TableCell({ children: [new Paragraph(`Tiết ${item.TuTiet || ''}-${item.DenTiet || ''} (${timeStr})`)] }),
            new TableCell({ children: [new Paragraph(cleanRoomName(item.TenPhong))] }),
            new TableCell({ children: [new Paragraph(item.TenGiangVien || "-")] }),
          ]
        })
      )
    })

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "THỜI KHÓA BIỂU SINH VIÊN UNETI",
                bold: true,
                size: 28,
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun({ text: `Sinh viên: `, bold: true }),
              new TextRun(`${data?.hoTen || "-"} (Mã SV: ${studentId})`),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Đơn vị / Lớp: `, bold: true }),
              new TextRun(data?.donVi || "-"),
            ],
          }),
          new Paragraph({ text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
        ],
      }],
    })

    const blob = await Packer.toBlob(doc)
    saveAs(blob, `LichHoc_UNETI_${data?.hoTen || studentId || 'SV'}.docx`)
    toast.success("Đã xuất file Word thành công!")
  }

  // Export to .ics
  const handleExportICS = () => {
    if (!filteredSchedule.length) {
      toast.error("Không có lịch học để xuất")
      return
    }

    let icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//UNETI Schedule//DichVuRight//VI",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH"
    ]

    filteredSchedule.forEach((item, idx) => {
      if (!item.NgayBatDau) return
      const datePart = item.NgayBatDau.split("T")[0].replace(/-/g, "")
      
      const tu = item.TuTiet || 1
      const den = item.DenTiet || 3
      const startObj = PERIOD_TIMES[tu] || { start: "07:00" }
      const endObj = PERIOD_TIMES[den] || { end: "11:10" }

      const startFormatted = startObj.start.replace(":", "") + "00"
      const endFormatted = endObj.end.replace(":", "") + "00"

      icsContent.push(
        "BEGIN:VEVENT",
        `UID:uneti-${item.MaLopHocPhan || idx}-${datePart}@dichvuright.com`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
        `DTSTART:${datePart}T${startFormatted}`,
        `DTEND:${datePart}T${endFormatted}`,
        `SUMMARY:${item.TenMonHoc || "Môn học UNETI"} (Tiết ${tu}-${den})`,
        `LOCATION:${cleanRoomName(item.TenPhong)}`,
        `DESCRIPTION:Giảng viên: ${item.TenGiangVien || "Chưa cập nhật"}\\nLớp: ${item.TenLopHoc || ""}\\nĐợt: ${item.TenDot || ""}`,
        "STATUS:CONFIRMED",
        "END:VEVENT"
      )
    })

    icsContent.push("END:VCALENDAR")

    const blob = new Blob([icsContent.join("\r\n")], { type: "text/calendar;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `LichHoc_UNETI_${data?.hoTen || studentId || "SV"}.ics`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success("Đã tải file .ics!")
  }

  // Header formatted time
  const formattedTimeLive = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

  return (
    <div className="space-y-3 max-w-7xl mx-auto">
      
      {/* 1. SEARCH INPUT CARD (Mobile Optimized) */}
      <Card className="shadow-sm border-primary/10 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
        <CardHeader className="bg-slate-50/70 dark:bg-slate-900/70 border-b py-2 px-3 sm:px-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm sm:text-base flex items-center gap-1.5 text-slate-800 dark:text-slate-100 font-bold truncate">
              <CalendarDays className="w-4 h-4 text-primary shrink-0" />
              <span>Tra cứu thời khóa biểu</span>
            </CardTitle>

            {/* Live Clock Badge */}
            <div className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {formattedTimeLive}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-2.5 sm:p-4 space-y-2">
          <form 
            onSubmit={(e) => {
              e.preventDefault()
              handleFetchSchedule()
            }}
            className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center"
          >
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="h-4 w-4" />
              </div>
              <Input
                id="studentId"
                type="text"
                placeholder="Nhập mã sinh viên (VD: 25103100132)..."
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs sm:text-sm font-medium rounded-xl border-slate-200 dark:border-slate-700"
                disabled={loading}
              />
              {studentId && (
                <button
                  type="button"
                  onClick={() => setStudentId("")}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <RainbowButton
              type="submit"
              disabled={loading || !studentId.trim()}
              className="h-9 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang tải...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Tra Cứu</span>
                </>
              )}
            </RainbowButton>
          </form>

          {/* Recent Searches Chips */}
          {recentSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-xs pt-0.5">
              <span className="text-slate-400 text-[10px] font-medium flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" /> Lưu gần đây:
              </span>
              {recentSearches.map((msv) => (
                <span
                  key={msv}
                  onClick={() => {
                    setStudentId(msv)
                    handleFetchSchedule(msv)
                  }}
                  className="group inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary text-slate-700 dark:text-slate-300 rounded-md cursor-pointer transition-colors border border-slate-200 dark:border-slate-700 font-mono text-[10px] font-semibold"
                >
                  <span>{msv}</span>
                  <button
                    onClick={(e) => removeRecentSearch(msv, e)}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. LOADING SKELETON */}
      {loading && (
        <div className="space-y-2.5 animate-in fade-in-50 duration-200">
          <Card className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-2/3 rounded" />
                <Skeleton className="h-3 w-1/3 rounded" />
              </div>
            </div>
          </Card>
          <Card className="p-3 space-y-2">
            <Skeleton className="h-8 w-full rounded-xl" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          </Card>
        </div>
      )}

      {/* 3. ERROR DISPLAY */}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-start gap-2 text-red-700 dark:text-red-300 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold">Không thể tải lịch học</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* 4. MAIN SCHEDULE DASHBOARD (Mobile First) */}
      {!loading && data && (
        <div className="space-y-2.5">
          
          {/* Compact Student Header Banner */}
          <Card className="shadow-xs border-primary/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2.5 sm:p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 bg-primary/10 text-primary rounded-xl shrink-0">
                  <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 uppercase truncate">
                    {data.hoTen || studentId}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                    {data.donVi || `Mã SV: ${studentId}`}
                  </p>
                </div>
              </div>

              {/* Quick Today Count Badge */}
              <div className="shrink-0 text-right bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 px-2 py-0.5 rounded-lg">
                <span className="text-[9px] text-blue-600 dark:text-blue-400 font-bold block leading-tight">HÔM NAY</span>
                <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                  {todayClasses.length} buổi
                </span>
              </div>
            </div>

            {/* Quick Metrics & Export Buttons Strip */}
            <div className="flex flex-wrap items-center justify-between gap-1 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium text-[10px] sm:text-xs">
                <span>Tổng: <strong className="text-slate-800 dark:text-slate-200">{filteredSchedule.length}</strong> buổi</span>
                {nextUpcomingClass && (
                  <span className="hidden sm:inline">• Sắp tới: <strong className="text-emerald-600 truncate max-w-[150px] inline-block align-bottom">{nextUpcomingClass.item.TenMonHoc}</strong></span>
                )}
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  className="h-6 px-1.5 text-[10px] font-semibold gap-0.5 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 rounded-md"
                >
                  <FileSpreadsheet className="w-2.5 h-2.5" /> Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportWord}
                  className="h-6 px-1.5 text-[10px] font-semibold gap-0.5 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 rounded-md"
                >
                  <FileText className="w-2.5 h-2.5" /> Word
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportICS}
                  className="h-6 px-1.5 text-[10px] font-semibold gap-0.5 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 rounded-md"
                >
                  <Download className="w-2.5 h-2.5" /> .ics
                </Button>
              </div>
            </div>
          </Card>

          {/* Main Schedule Container */}
          <Card className="shadow-sm border-primary/10 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
            
            {/* Toolbar Header */}
            <div className="p-2 sm:p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 space-y-2">
              
              {/* Row 1: 4 Equal Grid Tabs (100% Mobile Clean Fit) */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/80 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300">
                
                {/* TAB 1: HÔM NAY (FIRST) */}
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('today')
                    setCurrentDate(new Date())
                  }}
                  className={cn(
                    "py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 text-center truncate",
                    viewMode === 'today'
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "hover:bg-slate-100 dark:hover:bg-slate-700"
                  )}
                >
                  <Zap className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                  <span className="truncate">Hôm Nay ({todayClasses.length})</span>
                </button>

                {/* TAB 2: LỊCH TUẦN */}
                <button
                  type="button"
                  onClick={() => setViewMode('week')}
                  className={cn(
                    "py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 text-center truncate",
                    viewMode === 'week'
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "hover:bg-slate-100 dark:hover:bg-slate-700"
                  )}
                >
                  <CalendarDays className="w-3 h-3 shrink-0" />
                  <span>Tuần</span>
                </button>

                {/* TAB 3: LỊCH THÁNG */}
                <button
                  type="button"
                  onClick={() => setViewMode('month')}
                  className={cn(
                    "py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 text-center truncate",
                    viewMode === 'month'
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "hover:bg-slate-100 dark:hover:bg-slate-700"
                  )}
                >
                  <CalendarRange className="w-3 h-3 shrink-0" />
                  <span>Tháng</span>
                </button>

                {/* TAB 4: TOÀN BỘ */}
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 text-center truncate",
                    viewMode === 'list'
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "hover:bg-slate-100 dark:hover:bg-slate-700"
                  )}
                >
                  <TableIcon className="w-3 h-3 shrink-0" />
                  <span className="truncate">Tất Cả ({filteredSchedule.length})</span>
                </button>
              </div>

              {/* Row 2: Navigation Controls & Context */}
              <div className="flex items-center justify-between gap-1 text-xs">
                
                {/* Navigation Buttons */}
                <div className="inline-flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shadow-xs">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrev}
                    className="h-6 px-1.5 text-slate-600 dark:text-slate-300 font-medium text-xs"
                  >
                    <ChevronLeft className="w-3 h-3 mr-0.5" /> Trước
                  </Button>
                  <div className="h-3 w-[1px] bg-slate-200 dark:bg-slate-700" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNext}
                    className="h-6 px-1.5 text-slate-600 dark:text-slate-300 font-medium text-xs"
                  >
                    Sau <ChevronRight className="w-3 h-3 ml-0.5" />
                  </Button>
                </div>

                {/* View context label */}
                <div className="text-center font-bold text-slate-800 dark:text-slate-200 text-xs truncate px-1">
                  {viewMode === 'today' && (
                    <span>{getDayNameVN(currentDate.getDay())}, {String(currentDate.getDate()).padStart(2, '0')}/{String(currentDate.getMonth() + 1).padStart(2, '0')}</span>
                  )}
                  {viewMode === 'week' && (
                    <span>Tuần {getWeekNumber(currentDate)} / {currentDate.getFullYear()}</span>
                  )}
                  {viewMode === 'month' && (
                    <span>Tháng {currentDate.getMonth() + 1}/{currentDate.getFullYear()}</span>
                  )}
                  {viewMode === 'list' && (
                    <span>{filteredSchedule.length} buổi học</span>
                  )}
                </div>

                {/* Jump to Today Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToday}
                  className="h-6 px-2 text-xs font-bold gap-1 text-primary border-primary/20 hover:bg-primary/10 rounded-lg shadow-xs shrink-0"
                >
                  <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                  <span>Hôm Nay</span>
                </Button>

              </div>

              {/* Row 3: Filter Select & Search */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-800 text-xs">
                
                {/* shadcn Select for Semester Filter */}
                {semesters.length > 0 && (
                  <div className="w-full">
                    <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                      <SelectTrigger className="h-7 w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs shadow-xs">
                        <SelectValue placeholder="Chọn học kỳ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả ({data.body.length} buổi)</SelectItem>
                        {semesters.map((sem) => (
                          <SelectItem key={sem} value={sem}>{sem}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Search Filter */}
                <div className="relative w-full">
                  <Input
                    placeholder="Lọc môn học, phòng, GV..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="h-7 text-xs pl-6 pr-6 rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xs"
                  />
                  <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
                  {filterSearch && (
                    <button 
                      onClick={() => setFilterSearch("")}
                      className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

              </div>

            </div>

            {/* ========================================================================= */}
            {/* VIEW MODE 1: TODAY FOCUS VIEW (Hôm nay) */}
            {/* ========================================================================= */}
            {viewMode === 'today' && (
              <div className="p-2.5 sm:p-3 space-y-2.5">
                
                {/* Header Banner for Selected Day */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-blue-200">Chi Tiết Ngày Học</span>
                    <h3 className="text-sm sm:text-base font-black mt-0.5">
                      {getDayNameVN(currentDate.getDay())}, {String(currentDate.getDate()).padStart(2, '0')}/{String(currentDate.getMonth() + 1).padStart(2, '0')}/{currentDate.getFullYear()}
                    </h3>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[9px] text-blue-100 font-medium">Số buổi:</span>
                    <p className="text-base font-black">
                      {(scheduleByDate.get(formatDateKey(currentDate)) || []).length} buổi
                    </p>
                  </div>
                </div>

                {/* Day Classes */}
                {(() => {
                  const selectedDateKey = formatDateKey(currentDate)
                  const classes = scheduleByDate.get(selectedDateKey) || []

                  if (classes.length === 0) {
                    return (
                      <div className="py-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-850 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-1.5">
                        <CalendarIcon className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Không có lịch học vào ngày này</h4>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleToday}
                          className="mt-1 text-xs font-bold text-primary h-6 px-2.5"
                        >
                          Về ngày hôm nay
                        </Button>
                      </div>
                    )
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {classes.map((item, idx) => (
                        <ScheduleCardCompact 
                          key={`day-card-${idx}`}
                          item={item}
                          now={now}
                          getLiveClassStatus={getLiveClassStatus}
                          getTimeForPeriod={getTimeForPeriod}
                        />
                      ))}
                    </div>
                  )
                })()}

              </div>
            )}

            {/* ========================================================================= */}
            {/* VIEW MODE 2: WEEK VIEW (Tuần) - Native iOS Style 7-Day Bar */}
            {/* ========================================================================= */}
            {viewMode === 'week' && (
              <div className="p-2 sm:p-3 space-y-2.5">
                
                {/* 7-Day Compact Selector Bar */}
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((day) => {
                    const isSelected = day.isSelected
                    const isToday = day.isToday

                    return (
                      <button
                        key={day.dateKey}
                        onClick={() => setCurrentDate(day.date)}
                        className={cn(
                          "flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all border text-center relative select-none",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold scale-[1.02]"
                            : isToday
                            ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 font-bold"
                            : "bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                        )}
                      >
                        <span className={cn(
                          "text-[9px] font-semibold leading-none",
                          isSelected ? "text-primary-foreground" : day.isWeekend ? "text-red-500" : "text-slate-500 dark:text-slate-400"
                        )}>
                          {day.dayNameShort}
                        </span>

                        <span className={cn(
                          "text-xs sm:text-sm font-black my-0.5 leading-tight",
                          isSelected ? "text-primary-foreground" : day.isWeekend ? "text-red-500" : "text-slate-900 dark:text-slate-100"
                        )}>
                          {day.dayNum}
                        </span>

                        {/* Subtle Dot Indicator */}
                        {day.hasClasses ? (
                          <div className="flex items-center justify-center gap-0.5">
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              isSelected ? "bg-white" : "bg-emerald-500"
                            )} />
                            <span className={cn(
                              "text-[8px] font-bold leading-none hidden xs:inline",
                              isSelected ? "text-white" : "text-emerald-600 dark:text-emerald-400"
                            )}>
                              {day.classCount}
                            </span>
                          </div>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Week Schedule List (Grouped by Day) */}
                <div className="space-y-2 pt-0.5">
                  {weekDays.map((day) => {
                    const classes = scheduleByDate.get(day.dateKey) || []
                    const isToday = day.isToday
                    const isSelected = day.isSelected

                    return (
                      <div 
                        key={`week-day-group-${day.dateKey}`}
                        className={cn(
                          "rounded-xl border p-2 sm:p-3 transition-all space-y-1.5",
                          isToday
                            ? "bg-blue-50/20 dark:bg-blue-950/20 border-blue-300 dark:border-blue-900 shadow-xs"
                            : isSelected
                            ? "bg-slate-50/60 dark:bg-slate-850/50 border-primary/20"
                            : "bg-white dark:bg-slate-850 border-slate-200/70 dark:border-slate-800"
                        )}
                      >
                        {/* Day Header Badge */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black shadow-xs",
                              isToday
                                ? "bg-blue-600 text-white"
                                : "bg-slate-800 text-white dark:bg-slate-700"
                            )}>
                              {day.dayName}, {day.dayNum}/{String(day.date.getMonth() + 1).padStart(2, '0')}
                            </span>
                            {isToday && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-1 py-0.2 rounded">
                                <Zap className="w-2.5 h-2.5 fill-current" /> HÔM NAY
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] text-slate-400 font-medium">
                            {classes.length > 0 ? `${classes.length} buổi học` : "Nghỉ"}
                          </span>
                        </div>

                        {/* Cards for this day */}
                        {classes.length === 0 ? (
                          <div className="py-1.5 text-center text-slate-400 text-[10px] italic bg-slate-50/40 dark:bg-slate-900/20 rounded-lg border border-dashed border-slate-200/80 dark:border-slate-800">
                            Không có lịch học
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                            {classes.map((item, idx) => (
                              <ScheduleCardCompact 
                                key={`card-${day.dateKey}-${idx}`}
                                item={item}
                                now={now}
                                getLiveClassStatus={getLiveClassStatus}
                                getTimeForPeriod={getTimeForPeriod}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

              </div>
            )}

            {/* ========================================================================= */}
            {/* VIEW MODE 3: MONTH CALENDAR (Tháng) */}
            {/* ========================================================================= */}
            {viewMode === 'month' && (
              <div className="p-2 sm:p-3 space-y-2.5">
                
                {/* Month Matrix Card */}
                <div className="bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 p-2 sm:p-3 shadow-xs space-y-1.5">
                  
                  {/* Day of Week Headers */}
                  <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-300">T2</span>
                    <span className="text-slate-600 dark:text-slate-300">T3</span>
                    <span className="text-slate-600 dark:text-slate-300">T4</span>
                    <span className="text-slate-600 dark:text-slate-300">T5</span>
                    <span className="text-slate-600 dark:text-slate-300">T6</span>
                    <span className="text-red-500">T7</span>
                    <span className="text-red-500">CN</span>
                  </div>

                  {/* Calendar Matrix Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {monthMatrix.map((item, idx) => {
                      if (!item) {
                        return <div key={`month-empty-${idx}`} className="h-9 sm:h-11 rounded-lg bg-slate-50/20 dark:bg-slate-900/20" />
                      }

                      return (
                        <button
                          key={item.dateKey}
                          onClick={() => setCurrentDate(item.date)}
                          className={cn(
                            "h-9 sm:h-11 rounded-lg p-0.5 flex flex-col justify-between items-center transition-all border text-center relative",
                            item.isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold scale-[1.02]"
                              : item.isToday
                              ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-400 font-bold"
                              : "bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800"
                          )}
                        >
                          <span className={cn(
                            "text-[11px] font-bold leading-none",
                            item.isSelected ? "text-primary-foreground" : item.isWeekend ? "text-red-500" : "text-slate-800 dark:text-slate-200"
                          )}>
                            {item.dayNum}
                          </span>

                          {item.hasClasses ? (
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full mt-0.5",
                              item.isSelected ? "bg-white" : "bg-emerald-500"
                            )} />
                          ) : (
                            <span className="w-1.5 h-1.5" />
                          )}
                        </button>
                      )
                    })}
                  </div>

                </div>

                {/* Selected Date Schedule List */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary text-primary-foreground shadow-xs">
                      {getDayNameVN(currentDate.getDay())}, {String(currentDate.getDate()).padStart(2, '0')}/{String(currentDate.getMonth() + 1).padStart(2, '0')}
                    </span>
                    <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800" />
                  </div>

                  {(() => {
                    const selectedDateKey = formatDateKey(currentDate)
                    const classes = scheduleByDate.get(selectedDateKey) || []

                    if (classes.length === 0) {
                      return (
                        <div className="py-5 text-center text-slate-400 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium">
                          Không có lịch học nào trong ngày này
                        </div>
                      )
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        {classes.map((item, idx) => (
                          <ScheduleCardCompact 
                            key={`month-class-${idx}`}
                            item={item}
                            now={now}
                            getLiveClassStatus={getLiveClassStatus}
                            getTimeForPeriod={getTimeForPeriod}
                          />
                        ))}
                      </div>
                    )
                  })()}
                </div>

              </div>
            )}

            {/* ========================================================================= */}
            {/* VIEW MODE 4: FULL LIST & TABLE (Toàn bộ) */}
            {/* ========================================================================= */}
            {viewMode === 'list' && (
              <div className="p-2 sm:p-3 space-y-2">
                
                {filteredSchedule.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-850 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs">
                    Không tìm thấy buổi học nào phù hợp với bộ lọc
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 uppercase font-bold text-[9px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="p-1.5">STT</th>
                          <th className="p-1.5">Ngày / Thứ</th>
                          <th className="p-1.5">Môn Học</th>
                          <th className="p-1.5">Tiết & Giờ</th>
                          <th className="p-1.5">Phòng</th>
                          <th className="p-1.5">Giảng Viên</th>
                          <th className="p-1.5">Lớp HP</th>
                          <th className="p-1.5">Đợt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 font-medium">
                        {filteredSchedule.map((item, idx) => {
                          const isExam = checkIsExam(item)
                          const d = item.NgayBatDau ? new Date(item.NgayBatDau) : null
                          const thuStr = d ? getDayNameShortVN(d.getDay()) : "-"
                          const dateStr = item.NgayBatDau ? item.NgayBatDau.split("T")[0] : "-"
                          const timeStr = getTimeForPeriod(item.TuTiet, item.DenTiet)

                          return (
                            <tr 
                              key={`full-row-${idx}`}
                              className={cn(
                                "hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors",
                                isExam && "bg-amber-50/40 dark:bg-amber-950/20"
                              )}
                            >
                              <td className="p-1.5 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                              <td className="p-1.5 whitespace-nowrap">
                                <span className="font-bold text-slate-800 dark:text-slate-200">{thuStr}</span>
                                <span className="text-slate-400 text-[9px] ml-1 font-mono">({dateStr})</span>
                              </td>
                              <td className="p-1.5 font-bold text-slate-900 dark:text-slate-100">
                                {item.TenMonHoc || "-"}
                                {isExam && (
                                  <span className="ml-1 text-[8px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1 py-0.2 rounded font-bold">
                                    THI
                                  </span>
                                )}
                              </td>
                              <td className="p-1.5 whitespace-nowrap">
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {item.TuTiet && item.DenTiet ? `Tiết ${item.TuTiet}-${item.DenTiet}` : "-"}
                                </span>
                                {timeStr && (
                                  <span className="block text-[9px] text-blue-600 dark:text-blue-400 font-semibold">
                                    {timeStr}
                                  </span>
                                )}
                              </td>
                              <td className="p-1.5 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                {cleanRoomName(item.TenPhong)}
                              </td>
                              <td className="p-1.5 text-slate-700 dark:text-slate-300">
                                {item.TenGiangVien || "Chưa cập nhật"}
                              </td>
                              <td className="p-1.5 text-slate-500 dark:text-slate-400 text-[10px]">
                                {item.TenLopHoc || "-"}
                              </td>
                              <td className="p-1.5 text-slate-500 dark:text-slate-400 text-[10px] whitespace-nowrap">
                                {item.TenDot || "-"}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            )}

            {/* Bottom Status Legend */}
            <div className="p-2 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-400">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-medium">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Học chính khóa
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> Lịch thi
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" /> Trực tuyến
                  </span>
                </div>
                <div className="text-slate-400">
                  UNETI Edu
                </div>
              </div>
            </div>

          </Card>
        </div>
      )}
    </div>
  )
}

// Compact, Space-Optimized Schedule Card for Mobile & Desktop
function ScheduleCardCompact({ 
  item, 
  now, 
  getLiveClassStatus, 
  getTimeForPeriod 
}: { 
  item: ScheduleItem
  now: Date
  getLiveClassStatus: (item: ScheduleItem) => { status: string; label: string } | null
  getTimeForPeriod: (tuTiet?: number, denTiet?: number) => string | null
}) {
  const isExam = checkIsExam(item)
  const borderColor = isExam ? "border-l-amber-400" : "border-l-emerald-500"
  const liveStatus = getLiveClassStatus(item)
  const timePeriod = getTimeForPeriod(item.TuTiet, item.DenTiet)
  const roomClean = cleanRoomName(item.TenPhong)

  return (
    <div className={cn(
      "bg-white dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs p-2 sm:p-2.5 transition-all hover:shadow-sm border-l-4 space-y-1",
      borderColor,
      liveStatus?.status === 'active' && "ring-1.5 ring-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20"
    )}>
      {/* Header Row: Subject Name & Status Tag */}
      <div className="flex items-start justify-between gap-1.5">
        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
          {item.TenMonHoc || "Môn học chưa đặt tên"}
        </h4>
        {liveStatus ? (
          <span className={cn(
            "shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold",
            liveStatus.status === 'active'
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 animate-pulse"
              : liveStatus.status === 'upcoming'
              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          )}>
            <span className="w-1 h-1 rounded-full bg-current" />
            {liveStatus.label}
          </span>
        ) : isExam ? (
          <span className="shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.2 rounded-full text-[9px] font-bold">
            Lịch Thi
          </span>
        ) : null}
      </div>

      {/* Details Grid (Compact, High Density) */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
        
        {/* Tiết học & Thời gian */}
        <div>
          <span className="text-slate-400 font-medium block text-[9px] leading-none mb-0.5">Tiết & Giờ:</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 flex flex-wrap items-center gap-1 text-[11px]">
            <span>{item.TuTiet && item.DenTiet ? `Tiết ${item.TuTiet}-${item.DenTiet}` : "—"}</span>
            {timePeriod && (
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950/50 px-1 rounded">
                {timePeriod}
              </span>
            )}
          </span>
        </div>

        {/* Phòng học */}
        <div>
          <span className="text-slate-400 font-medium block text-[9px] leading-none mb-0.5">Phòng:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-0.5 text-[11px] truncate">
            <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
            <span className="truncate">{roomClean}</span>
          </span>
        </div>

        {/* Giảng viên */}
        <div className="col-span-2 pt-1 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between gap-1 text-[10px]">
          <div className="truncate">
            <span className="text-slate-400 font-medium mr-1">GV:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
              {item.TenGiangVien || "Chưa cập nhật"}
            </span>
          </div>
          {item.CaHoc && (
            <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-1 py-0.2 rounded font-medium shrink-0">
              {item.CaHoc}
            </span>
          )}
        </div>

      </div>

      {/* Footer Tag */}
      {(item.TenLopHoc || item.TenDot) && (
        <div className="pt-0.5 border-t border-slate-100 dark:border-slate-700/30 flex items-center justify-between text-[9px] text-slate-400">
          <span className="truncate max-w-[150px]">{item.TenLopHoc}</span>
          <span className="shrink-0">{item.TenDot}</span>
        </div>
      )}
    </div>
  )
}
