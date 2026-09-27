"use client"

import { createClientShieldToken } from "@/lib/shield"

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
  Sparkles,
  BookOpen,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  CalendarCheck,
  Zap,
  ArrowRight,
  Filter,
  Layers,
  CalendarRange,
  ListFilter,
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

// Check if an item is truly an Exam (Lịch Thi) accurately without false positives
const checkIsExam = (item: ScheduleItem): boolean => {
  const name = (item.TenMonHoc || "").trim().toLowerCase()
  const dot = (item.TenDot || "").trim().toLowerCase()
  const phong = (item.TenPhong || "").trim().toLowerCase()

  // Match standalone word 'thi' or exam phrases
  // Avoid matching 'thiết kế', 'thông tin', 'thực thi', 'thích ứng', etc.
  const words = name.split(/[\s,.-]+/)
  const hasThiWord = words.includes('thi') || words.includes('kthp') || name.startsWith('thi ') || name.endsWith(' thi')
  const isExamDot = dot.includes('lịch thi') || dot.includes('thi kết thúc') || dot.includes('thi kthp')
  const isExamRoom = phong.includes('phòng thi') || phong.includes('p.thi')

  return hasThiWord || isExamDot || isExamRoom
}

export default function ScheduleViewer() {
  const [studentId, setStudentId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<StudentScheduleData | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // Live real-time ticking clock (updated every 1s)
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

  // Fetch schedule from proxy API
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
        throw new Error(`Lỗi kết nối máy chủ (${response.status})`)
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
        // Find nearest class date
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

      toast.success(`Đã tải thành công ${resJson.body.length} buổi học của sinh viên ${resJson.hoTen || targetId}`)

    } catch (err: any) {
      console.error(err)
      setError(err.message || "Không thể tải lịch học. Vui lòng thử lại sau.")
      toast.error(err.message || "Lỗi tải lịch học")
    } finally {
      setLoading(false)
    }
  }

  // Extract unique semesters / dot hoc
  const semesters = useMemo(() => {
    if (!data?.body) return []
    const set = new Set<string>()
    data.body.forEach(item => {
      if (item.TenDot) set.add(item.TenDot)
    })
    return Array.from(set).sort().reverse()
  }, [data])

  // Filtered schedule list
  const filteredSchedule = useMemo(() => {
    if (!data?.body) return []
    return data.body.filter(item => {
      // Semester filter
      if (selectedSemester !== "all" && item.TenDot !== selectedSemester) {
        return false
      }
      // Text search filter
      if (filterSearch.trim()) {
        const query = filterSearch.toLowerCase()
        const subject = (item.TenMonHoc || "").toLowerCase()
        const room = (item.TenPhong || "").toLowerCase()
        const teacher = (item.TenGiangVien || "").toLowerCase()
        const group = (item.TenLopHoc || "").toLowerCase()
        return subject.includes(query) || room.includes(query) || teacher.includes(query) || group.includes(query)
      }
      return true
    })
  }, [data, selectedSemester, filterSearch])

  // Schedule mapped by YYYY-MM-DD
  const scheduleByDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>()
    filteredSchedule.forEach(item => {
      if (item.NgayBatDau) {
        const dateStr = item.NgayBatDau.split("T")[0]
        if (!map.has(dateStr)) {
          map.set(dateStr, [])
        }
        map.get(dateStr)!.push(item)
      }
    })
    map.forEach(list => {
      list.sort((a, b) => (a.TuTiet || 0) - (b.TuTiet || 0))
    })
    return map
  }, [filteredSchedule])

  // Date helper functions
  const formatDateKey = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const getDayNameVN = (dayOfWeek: number) => {
    if (dayOfWeek === 0) return "Chủ Nhật"
    return `Thứ ${dayOfWeek + 1}`
  }

  const getDayNameShortVN = (dayOfWeek: number) => {
    if (dayOfWeek === 0) return "CN"
    return `Th ${dayOfWeek + 1}`
  }

  const getWeekNumber = (d: Date) => {
    const target = new Date(d.valueOf())
    const dayNr = (d.getDay() + 6) % 7
    target.setDate(target.getDate() - dayNr + 3)
    const firstThursday = target.valueOf()
    target.setMonth(0, 1)
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7)
    }
    return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
  }

  const getMondayOfWeek = (d: Date) => {
    const date = new Date(d)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    date.setDate(diff)
    date.setHours(0, 0, 0, 0)
    return date
  }

  // 7 days of current selected week
  const weekDays = useMemo(() => {
    const monday = getMondayOfWeek(currentDate)
    const days: { 
      date: Date; 
      dateKey: string; 
      dayName: string; 
      dayNameShort: string;
      dayNum: string; 
      isToday: boolean; 
      isSelected: boolean; 
      hasClasses: boolean; 
      isWeekend: boolean;
      classCount: number;
    }[] = []
    
    const todayKey = formatDateKey(new Date())
    const selectedKey = formatDateKey(currentDate)

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const dateKey = formatDateKey(d)
      const dayOfWeek = d.getDay()
      const classCount = scheduleByDate.get(dateKey)?.length || 0
      
      days.push({
        date: d,
        dateKey,
        dayName: getDayNameVN(dayOfWeek),
        dayNameShort: getDayNameShortVN(dayOfWeek),
        dayNum: String(d.getDate()).padStart(2, '0'),
        isToday: dateKey === todayKey,
        isSelected: dateKey === selectedKey,
        hasClasses: classCount > 0,
        classCount,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6
      })
    }
    return days
  }, [currentDate, scheduleByDate])

  // Navigation handlers
  const handlePrev = () => {
    const next = new Date(currentDate)
    if (viewMode === 'today') {
      next.setDate(next.getDate() - 1)
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() - 7)
    } else if (viewMode === 'month') {
      next.setMonth(next.getMonth() - 1)
    }
    setCurrentDate(next)
  }

  const handleNext = () => {
    const next = new Date(currentDate)
    if (viewMode === 'today') {
      next.setDate(next.getDate() + 1)
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() + 7)
    } else if (viewMode === 'month') {
      next.setMonth(next.getMonth() + 1)
    }
    setCurrentDate(next)
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Monthly calendar matrix
  const monthMatrix = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    
    let startDay = firstDayOfMonth.getDay() - 1
    if (startDay === -1) startDay = 6

    const totalDays = lastDayOfMonth.getDate()
    const days: ({ 
      date: Date; 
      dateKey: string; 
      dayNum: number; 
      hasClasses: boolean; 
      isCurrentMonth: boolean; 
      isToday: boolean; 
      isSelected: boolean; 
      isWeekend: boolean;
      classCount: number;
    } | null)[] = []

    for (let i = 0; i < startDay; i++) {
      days.push(null)
    }

    const todayKey = formatDateKey(new Date())
    const selectedKey = formatDateKey(currentDate)

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d)
      const dateKey = formatDateKey(date)
      const dayOfWeek = date.getDay()
      const classCount = scheduleByDate.get(dateKey)?.length || 0

      days.push({
        date,
        dateKey,
        dayNum: d,
        hasClasses: classCount > 0,
        classCount,
        isCurrentMonth: true,
        isToday: dateKey === todayKey,
        isSelected: dateKey === selectedKey,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6
      })
    }

    return days
  }, [currentDate, scheduleByDate])

  // Get period start/end times
  const getTimeForPeriod = (tuTiet?: number, denTiet?: number) => {
    if (!tuTiet || !denTiet) return null
    const startObj = PERIOD_TIMES[tuTiet]
    const endObj = PERIOD_TIMES[denTiet]
    if (startObj && endObj) {
      return `${startObj.start} - ${endObj.end}`
    }
    return null
  }

  // Check real-time live status of a class session
  const getLiveClassStatus = (item: ScheduleItem) => {
    if (!item.NgayBatDau || !item.TuTiet || !item.DenTiet) return null
    const dateStr = item.NgayBatDau.split("T")[0]
    const todayStr = formatDateKey(now)
    if (dateStr !== todayStr) return null

    const startObj = PERIOD_TIMES[item.TuTiet]
    const endObj = PERIOD_TIMES[item.DenTiet]
    if (!startObj || !endObj) return null

    const [startH, startM] = startObj.start.split(":").map(Number)
    const [endH, endM] = endObj.end.split(":").map(Number)

    const startTime = new Date(now)
    startTime.setHours(startH, startM, 0, 0)

    const endTime = new Date(now)
    endTime.setHours(endH, endM, 0, 0)

    if (now >= startTime && now <= endTime) {
      const remainMinutes = Math.max(1, Math.round((endTime.getTime() - now.getTime()) / 60000))
      return { status: 'active', label: `Đang diễn ra (còn ${remainMinutes}p)` }
    }

    if (now < startTime) {
      const diffMinutes = Math.round((startTime.getTime() - now.getTime()) / 60000)
      if (diffMinutes <= 90 && diffMinutes > 0) {
        return { status: 'upcoming', label: `Bắt đầu sau ${diffMinutes}p` }
      }
    }

    if (now > endTime) {
      return { status: 'finished', label: 'Đã hoàn thành' }
    }

    return null
  }

  // Today classes summary
  const todayClasses = useMemo(() => {
    const todayKey = formatDateKey(now)
    return scheduleByDate.get(todayKey) || []
  }, [now, scheduleByDate])

  // Next upcoming class across all dates
  const nextUpcomingClass = useMemo(() => {
    if (!data?.body || data.body.length === 0) return null
    const nowTime = now.getTime()

    let nextItem: { item: ScheduleItem; dateTime: Date } | null = null
    let minFutureDiff = Infinity

    for (const item of data.body) {
      if (!item.NgayBatDau || !item.TuTiet) continue
      const dateStr = item.NgayBatDau.split("T")[0]
      const startObj = PERIOD_TIMES[item.TuTiet] || { start: "07:00" }
      const [h, m] = startObj.start.split(":").map(Number)
      
      const sessionDate = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
      const diff = sessionDate.getTime() - nowTime

      if (diff > 0 && diff < minFutureDiff) {
        minFutureDiff = diff
        nextItem = { item, dateTime: sessionDate }
      }
    }

    return nextItem
  }, [data, now])

  // Export handlers
  const handleExportExcel = () => {
    if (!filteredSchedule.length) {
      toast.error("Không có lịch học để xuất")
      return
    }

    const rows = [
      ["THỜI KHÓA BIỂU SINH VIÊN UNETI"],
      ["Họ và tên:", data?.hoTen || "-", "Mã sinh viên:", studentId || "-"],
      ["Đơn vị / Lớp:", data?.donVi || "-", "Tổng số buổi học:", filteredSchedule.length],
      [],
      ["STT", "Thứ", "Ngày", "Môn học", "Tiết", "Thời gian", "Phòng", "Giảng viên", "Lớp học phần", "Đợt"]
    ]

    filteredSchedule.forEach((item, index) => {
      const dateStr = item.NgayBatDau ? item.NgayBatDau.split("T")[0] : "-"
      const d = item.NgayBatDau ? new Date(item.NgayBatDau) : null
      const thuStr = d ? getDayNameVN(d.getDay()) : "-"
      const timeStr = getTimeForPeriod(item.TuTiet, item.DenTiet) || "-"

      rows.push([
        index + 1,
        thuStr,
        dateStr,
        item.TenMonHoc || "-",
        item.TuTiet && item.DenTiet ? `${item.TuTiet} - ${item.DenTiet}` : "-",
        timeStr,
        item.TenPhong || "-",
        item.TenGiangVien || "-",
        item.TenLopHoc || "-",
        item.TenDot || "-"
      ])
    })

    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "LichHoc")
    XLSX.writeFile(wb, `LichHoc_UNETI_${data?.hoTen || studentId || 'SV'}.xlsx`)
    toast.success("Đã xuất file Excel thành công!")
  }

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
            new TableCell({ children: [new Paragraph(item.TenPhong || "-")] }),
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
        `LOCATION:${item.TenPhong || "Phòng học UNETI"}`,
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

    toast.success("Đã tải file .ics! Bạn có thể nhập vào Google Calendar hoặc Apple Calendar.")
  }

  // Formatted date string for header
  const formattedTodayHeader = `${getDayNameVN(now.getDay())}, ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
  const formattedTimeLive = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      
      {/* 1. SEARCH INPUT CARD (Compact Base Style) */}
      <Card className="shadow-lg border-primary/10 overflow-hidden bg-white/85 dark:bg-slate-900/85 backdrop-blur-md">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b py-3 px-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <CardTitle className="text-lg sm:text-xl flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold">
              <CalendarDays className="w-5 h-5 text-primary" />
              Tra cứu Thời khóa biểu & Lịch thi UNETI
            </CardTitle>

            {/* Real-Time Live Clock Badge */}
            <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold border border-primary/20 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Clock className="w-3.5 h-3.5" />
              <span>{formattedTodayHeader}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-white/60 dark:bg-slate-800/60 px-1.5 py-0.2 rounded">
                {formattedTimeLive}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3.5 sm:p-5 space-y-3">
          <form 
            onSubmit={(e) => {
              e.preventDefault()
              handleFetchSchedule()
            }}
            className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center"
          >
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="h-4 w-4" />
              </div>
              <Input
                id="studentId"
                type="text"
                placeholder="Nhập mã sinh viên UNETI (Ví dụ: 25103100132)..."
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="pl-10 pr-10 h-11 text-sm sm:text-base font-medium shadow-sm rounded-xl border-slate-200 dark:border-slate-700 focus-visible:ring-primary"
                disabled={loading}
              />
              {studentId && (
                <button
                  type="button"
                  onClick={() => setStudentId("")}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <RainbowButton
              type="submit"
              disabled={loading || !studentId.trim()}
              className="h-11 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shrink-0 shadow-md cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang tải...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Tra Cứu Lịch</span>
                </>
              )}
            </RainbowButton>
          </form>

          {/* Recent Searches Chips */}
          {recentSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Lịch sử:
              </span>
              {recentSearches.map((msv) => (
                <span
                  key={msv}
                  onClick={() => {
                    setStudentId(msv)
                    handleFetchSchedule(msv)
                  }}
                  className="group inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer transition-colors border border-slate-200 dark:border-slate-700 font-mono text-xs font-semibold"
                >
                  <span>{msv}</span>
                  <button
                    onClick={(e) => removeRecentSearch(msv, e)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. LOADING SKELETON STATE */}
      {loading && (
        <div className="space-y-4 animate-in fade-in-50 duration-300">
          {/* Skeleton Profile & KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <Card className="md:col-span-6 lg:col-span-5 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-3/4 rounded" />
                  <Skeleton className="h-3.5 w-1/2 rounded" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-7 w-20 rounded-lg" />
                <Skeleton className="h-7 w-20 rounded-lg" />
                <Skeleton className="h-7 w-24 rounded-lg" />
              </div>
            </Card>

            <div className="md:col-span-6 lg:col-span-7 grid grid-cols-3 gap-2.5">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          </div>

          {/* Skeleton Main Table/View Card */}
          <Card className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-9 w-64 rounded-xl" />
              <Skeleton className="h-8 w-40 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          </Card>
        </div>
      )}

      {/* 3. ERROR DISPLAY */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-red-700 dark:text-red-300 shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <p className="font-bold">Không thể tải lịch học</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* 4. MAIN SCHEDULE DASHBOARD (COMPACT & UNIFIED) */}
      {!loading && data && (
        <div className="space-y-4">
          
          {/* Student Overview & Compact Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            
            {/* Student Info Card */}
            <Card className="md:col-span-6 lg:col-span-5 shadow-md border-primary/10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 flex flex-col justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sinh Viên UNETI</span>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 uppercase truncate">
                    {data.hoTen || studentId}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium truncate">
                    {data.donVi || `Mã SV: ${studentId}`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  className="h-7 text-xs font-semibold gap-1 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg px-2.5"
                >
                  <FileSpreadsheet className="w-3 h-3" /> Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportWord}
                  className="h-7 text-xs font-semibold gap-1 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg px-2.5"
                >
                  <FileText className="w-3 h-3" /> Word
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportICS}
                  className="h-7 text-xs font-semibold gap-1 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-lg px-2.5"
                >
                  <Download className="w-3 h-3" /> Đồng bộ .ics
                </Button>
              </div>
            </Card>

            {/* Quick Compact KPI Stats */}
            <div className="md:col-span-6 lg:col-span-7 grid grid-cols-3 gap-2.5">
              
              {/* Stat 1: Hôm nay */}
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                  <span>Hôm nay</span>
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="my-1">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                    {todayClasses.length}
                  </span>
                  <span className="text-[11px] text-slate-500 ml-1">buổi</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {todayClasses.length > 0 ? "Có lịch học" : "Nghỉ học"}
                </div>
              </div>

              {/* Stat 2: Tổng buổi học */}
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                  <span>Tổng số</span>
                  <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div className="my-1">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                    {filteredSchedule.length}
                  </span>
                  <span className="text-[11px] text-slate-500 ml-1">buổi</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  Đã tải vào hệ thống
                </div>
              </div>

              {/* Stat 3: Môn học tiếp theo */}
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
                  <span>Kế tiếp</span>
                  <Clock className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="my-0.5">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {nextUpcomingClass ? nextUpcomingClass.item.TenMonHoc : "Đã hết lịch"}
                  </p>
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold truncate">
                  {nextUpcomingClass ? `Tiết ${nextUpcomingClass.item.TuTiet}-${nextUpcomingClass.item.DenTiet} (${nextUpcomingClass.item.TenPhong || 'TBA'})` : "—"}
                </div>
              </div>

            </div>

          </div>

          {/* Unified Schedule Main Container Card */}
          <Card className="shadow-xl border-primary/10 overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
            
            {/* Toolbar Header */}
            <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 space-y-3">
              
              {/* Top Row: View Mode Tabs & Navigation */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                
                {/* 4 View Modes Segmented Control - 'Hôm Nay' FIRST before 'Lịch Tuần' */}
                <div className="inline-flex p-1 bg-slate-200/80 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300">
                  
                  {/* TAB 1: HÔM NAY (FIRST) */}
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('today')
                      setCurrentDate(new Date())
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                      viewMode === 'today'
                        ? "bg-primary text-primary-foreground shadow-sm font-bold"
                        : "hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    Hôm Nay ({todayClasses.length})
                  </button>

                  {/* TAB 2: LỊCH TUẦN */}
                  <button
                    type="button"
                    onClick={() => setViewMode('week')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                      viewMode === 'week'
                        ? "bg-primary text-primary-foreground shadow-sm font-bold"
                        : "hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    Lịch Tuần
                  </button>

                  {/* TAB 3: LỊCH THÁNG */}
                  <button
                    type="button"
                    onClick={() => setViewMode('month')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                      viewMode === 'month'
                        ? "bg-primary text-primary-foreground shadow-sm font-bold"
                        : "hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <CalendarRange className="w-3.5 h-3.5" />
                    Lịch Tháng
                  </button>

                  {/* TAB 4: TOÀN BỘ LỊCH */}
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                      viewMode === 'list'
                        ? "bg-primary text-primary-foreground shadow-sm font-bold"
                        : "hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    Toàn Bộ ({filteredSchedule.length})
                  </button>
                </div>

                {/* Date Navigation & Jump to Today */}
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shadow-sm text-xs">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrev}
                      className="h-7 px-2 text-slate-600 dark:text-slate-300 font-medium"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Trước
                    </Button>
                    <div className="h-3.5 w-[1px] bg-slate-200 dark:bg-slate-700" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNext}
                      className="h-7 px-2 text-slate-600 dark:text-slate-300 font-medium"
                    >
                      Sau <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleToday}
                    className="h-7 px-2.5 text-xs font-bold gap-1 text-primary border-primary/20 hover:bg-primary/10 rounded-lg shadow-sm"
                  >
                    <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                    Về Hôm Nay
                  </Button>
                </div>

              </div>

              {/* Bottom Row: Filters with shadcn Select & Search */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800 text-xs">
                
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  
                  {/* shadcn Select for Semester Filter */}
                  {semesters.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-semibold shrink-0">Học kỳ:</span>
                      <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                        <SelectTrigger className="h-8 w-[190px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-xs shadow-xs">
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

                  {/* Filter Search */}
                  <div className="relative max-w-xs flex-1 min-w-[150px]">
                    <Input
                      placeholder="Lọc môn học, phòng, GV..."
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      className="h-8 text-xs pl-7 pr-7 rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    />
                    <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-slate-400" />
                    {filterSearch && (
                      <button 
                        onClick={() => setFilterSearch("")}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* View context label */}
                <div className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                  {viewMode === 'today' && (
                    <span><strong className="text-slate-800 dark:text-slate-200">{getDayNameVN(currentDate.getDay())}, {String(currentDate.getDate()).padStart(2, '0')}/{String(currentDate.getMonth() + 1).padStart(2, '0')}</strong></span>
                  )}
                  {viewMode === 'week' && (
                    <span>Năm {currentDate.getFullYear()} — <strong className="text-slate-800 dark:text-slate-200">Tuần {getWeekNumber(currentDate)}</strong></span>
                  )}
                  {viewMode === 'month' && (
                    <span><strong className="text-slate-800 dark:text-slate-200">Tháng {currentDate.getMonth() + 1}, {currentDate.getFullYear()}</strong></span>
                  )}
                  {viewMode === 'list' && (
                    <span>Hiển thị: <strong className="text-slate-800 dark:text-slate-200">{filteredSchedule.length}</strong> buổi học</span>
                  )}
                </div>

              </div>

            </div>

            {/* ========================================================================= */}
            {/* VIEW MODE 1: TODAY FOCUS VIEW (Hôm nay) */}
            {/* ========================================================================= */}
            {viewMode === 'today' && (
              <div className="p-3 sm:p-5 space-y-4">
                
                {/* Header Banner for Selected Day */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200">Lịch Học Hôm Nay</span>
                    <h3 className="text-lg sm:text-xl font-black mt-0.5">
                      {getDayNameVN(currentDate.getDay())}, {String(currentDate.getDate()).padStart(2, '0')}/{String(currentDate.getMonth() + 1).padStart(2, '0')}/{currentDate.getFullYear()}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-blue-100 font-medium">Số buổi hôm nay:</span>
                    <p className="text-xl font-black">
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
                      <div className="py-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-850 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2.5">
                        <CalendarIcon className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Không có lịch học vào ngày này</h4>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleToday}
                          className="mt-1 text-xs font-bold text-primary"
                        >
                          Về ngày hôm nay
                        </Button>
                      </div>
                    )
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            {/* VIEW MODE 2: WEEK VIEW (Tuần) - Compact 7-Day Matrix & Timeline */}
            {/* ========================================================================= */}
            {viewMode === 'week' && (
              <div className="p-3 sm:p-5 space-y-4">
                
                {/* 7-Day Compact Selector Bar */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {weekDays.map((day) => {
                    const isSelected = day.isSelected
                    const isToday = day.isToday

                    return (
                      <button
                        key={day.dateKey}
                        onClick={() => setCurrentDate(day.date)}
                        className={cn(
                          "flex flex-col items-center justify-center p-1.5 sm:p-2.5 rounded-xl transition-all border text-center relative",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]"
                            : isToday
                            ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-400 dark:border-blue-700 font-bold"
                            : "bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800"
                        )}
                      >
                        <span className={cn(
                          "text-[10px] font-semibold",
                          isSelected ? "text-primary-foreground" : day.isWeekend ? "text-red-500" : "text-slate-500 dark:text-slate-400"
                        )}>
                          {day.dayNameShort}
                        </span>

                        <span className={cn(
                          "text-sm sm:text-lg font-black mt-0.5",
                          isSelected ? "text-primary-foreground" : day.isWeekend ? "text-red-500" : "text-slate-800 dark:text-slate-100"
                        )}>
                          {day.dayNum}
                        </span>

                        {/* Class counter badge / Dot */}
                        {day.hasClasses ? (
                          <span className={cn(
                            "mt-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold",
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          )}>
                            {day.classCount} buổi
                          </span>
                        ) : (
                          <span className="mt-0.5 text-[9px] text-slate-300 dark:text-slate-600 font-medium">—</span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Week Schedule List (Grouped by Day, Compact Cards) */}
                <div className="space-y-4 pt-1">
                  {weekDays.map((day) => {
                    const classes = scheduleByDate.get(day.dateKey) || []
                    const isToday = day.isToday
                    const isSelected = day.isSelected

                    return (
                      <div 
                        key={`week-day-group-${day.dateKey}`}
                        className={cn(
                          "rounded-xl border p-3 sm:p-4 transition-all space-y-2.5",
                          isToday
                            ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-300 dark:border-blue-900 shadow-sm"
                            : isSelected
                            ? "bg-slate-50/80 dark:bg-slate-850/60 border-primary/30"
                            : "bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800"
                        )}
                      >
                        {/* Day Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-black shadow-sm",
                              isToday
                                ? "bg-blue-600 text-white"
                                : "bg-slate-800 text-white dark:bg-slate-700"
                            )}>
                              {day.dayName}, {day.dayNum}/{String(day.date.getMonth() + 1).padStart(2, '0')}
                            </span>
                            {isToday && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.2 rounded">
                                <Zap className="w-3 h-3 fill-current" /> HÔM NAY
                              </span>
                            )}
                          </div>

                          <span className="text-xs text-slate-400 font-medium">
                            {classes.length > 0 ? `${classes.length} buổi học` : "Nghỉ học"}
                          </span>
                        </div>

                        {/* Cards for this day */}
                        {classes.length === 0 ? (
                          <div className="py-2.5 text-center text-slate-400 text-xs italic bg-slate-50/50 dark:bg-slate-900/30 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                            Không có lịch học trong ngày này
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
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
              <div className="p-3 sm:p-5 space-y-4">
                
                {/* Month Matrix Card */}
                <div className="bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 shadow-sm space-y-3">
                  
                  {/* Day of Week Headers */}
                  <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-300">Th 2</span>
                    <span className="text-slate-600 dark:text-slate-300">Th 3</span>
                    <span className="text-slate-600 dark:text-slate-300">Th 4</span>
                    <span className="text-slate-600 dark:text-slate-300">Th 5</span>
                    <span className="text-slate-600 dark:text-slate-300">Th 6</span>
                    <span className="text-red-500">Th 7</span>
                    <span className="text-red-500">CN</span>
                  </div>

                  {/* Calendar Matrix Grid */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                    {monthMatrix.map((item, idx) => {
                      if (!item) {
                        return <div key={`month-empty-${idx}`} className="h-12 sm:h-16 rounded-lg bg-slate-50/30 dark:bg-slate-900/30" />
                      }

                      return (
                        <button
                          key={item.dateKey}
                          onClick={() => setCurrentDate(item.date)}
                          className={cn(
                            "h-12 sm:h-16 rounded-lg p-1 sm:p-1.5 flex flex-col justify-between items-start transition-all border text-left relative",
                            item.isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]"
                              : item.isToday
                              ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-400 font-bold"
                              : "bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800"
                          )}
                        >
                          <span className={cn(
                            "text-xs sm:text-sm font-bold",
                            item.isSelected ? "text-primary-foreground" : item.isWeekend ? "text-red-500" : "text-slate-800 dark:text-slate-200"
                          )}>
                            {item.dayNum}
                          </span>

                          {item.hasClasses && (
                            <span className={cn(
                              "text-[9px] font-bold px-1.5 py-0.2 rounded-full truncate max-w-full",
                              item.isSelected 
                                ? "bg-white/20 text-white" 
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            )}>
                              {item.classCount}b
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                </div>

                {/* Selected Date Schedule List */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-bold bg-primary text-primary-foreground shadow-sm">
                      {getDayNameVN(currentDate.getDay())}, {String(currentDate.getDate()).padStart(2, '0')}/{String(currentDate.getMonth() + 1).padStart(2, '0')}/{currentDate.getFullYear()}
                    </span>
                    <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800" />
                  </div>

                  {(() => {
                    const selectedDateKey = formatDateKey(currentDate)
                    const classes = scheduleByDate.get(selectedDateKey) || []

                    if (classes.length === 0) {
                      return (
                        <div className="py-8 text-center text-slate-400 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium">
                          Không có lịch học nào trong ngày này
                        </div>
                      )
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
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
              <div className="p-3 sm:p-5 space-y-3">
                
                {filteredSchedule.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-850 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs">
                    Không tìm thấy buổi học nào phù hợp với bộ lọc
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="p-2.5">STT</th>
                          <th className="p-2.5">Ngày / Thứ</th>
                          <th className="p-2.5">Môn Học</th>
                          <th className="p-2.5">Tiết & Giờ</th>
                          <th className="p-2.5">Phòng</th>
                          <th className="p-2.5">Giảng Viên</th>
                          <th className="p-2.5">Lớp HP</th>
                          <th className="p-2.5">Đợt</th>
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
                              <td className="p-2.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                              <td className="p-2.5 whitespace-nowrap">
                                <span className="font-bold text-slate-800 dark:text-slate-200">{thuStr}</span>
                                <span className="text-slate-400 text-[11px] ml-1 font-mono">({dateStr})</span>
                              </td>
                              <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">
                                {item.TenMonHoc || "-"}
                                {isExam && (
                                  <span className="ml-1.5 text-[9px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-1.5 py-0.2 rounded font-bold">
                                    LỊCH THI
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 whitespace-nowrap">
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {item.TuTiet && item.DenTiet ? `Tiết ${item.TuTiet}-${item.DenTiet}` : "-"}
                                </span>
                                {timeStr && (
                                  <span className="block text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                                    {timeStr}
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                {item.TenPhong || "TBA"}
                              </td>
                              <td className="p-2.5 text-slate-700 dark:text-slate-300">
                                {item.TenGiangVien || "Chưa cập nhật"}
                              </td>
                              <td className="p-2.5 text-slate-500 dark:text-slate-400 text-[11px]">
                                {item.TenLopHoc || "-"}
                              </td>
                              <td className="p-2.5 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
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
            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-medium text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Lịch học chính khóa
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> Lịch thi / Đánh giá
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" /> Lịch trực tuyến
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Tạm ngưng
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Hệ thống kiểm tra và đối soát chuẩn xác dữ liệu đào tạo UNETI.
                </div>
              </div>
            </div>

          </Card>
        </div>
      )}
    </div>
  )
}

// Compact, Space-Optimized Schedule Card
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

  return (
    <div className={cn(
      "bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs p-3 transition-all hover:shadow-md border-l-4 space-y-2",
      borderColor,
      liveStatus?.status === 'active' && "ring-1.5 ring-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20"
    )}>
      {/* Header Row: Subject Name & Status Tag */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
          {item.TenMonHoc || "Môn học chưa đặt tên"}
        </h4>
        {liveStatus ? (
          <span className={cn(
            "shrink-0 inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold",
            liveStatus.status === 'active'
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 animate-pulse"
              : liveStatus.status === 'upcoming'
              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          )}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {liveStatus.label}
          </span>
        ) : isExam ? (
          <span className="shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.2 rounded-full text-[10px] font-bold">
            Lịch Thi
          </span>
        ) : null}
      </div>

      {/* Details Grid (Compact, High Density) */}
      <div className="grid grid-cols-2 gap-x-2.5 gap-y-1 text-xs">
        
        {/* Tiết học & Thời gian */}
        <div>
          <span className="text-slate-400 font-medium block text-[10px]">Tiết & Giờ:</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 flex flex-wrap items-center gap-1">
            <span>{item.TuTiet && item.DenTiet ? `Tiết ${item.TuTiet}-${item.DenTiet}` : "—"}</span>
            {timePeriod && (
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950/50 px-1 rounded">
                {timePeriod}
              </span>
            )}
          </span>
        </div>

        {/* Phòng học */}
        <div>
          <span className="text-slate-400 font-medium block text-[10px]">Phòng học:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
            <span className="truncate">{item.TenPhong || "Chưa xếp phòng"}</span>
          </span>
        </div>

        {/* Giảng viên */}
        <div className="col-span-2 pt-1 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-1 text-[11px]">
          <div>
            <span className="text-slate-400 font-medium mr-1">Giảng viên:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {item.TenGiangVien || "Chưa cập nhật"}
            </span>
          </div>
          {item.CaHoc && (
            <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.2 rounded font-medium">
              {item.CaHoc}
            </span>
          )}
        </div>

      </div>

      {/* Footer Tag */}
      {(item.TenLopHoc || item.TenDot) && (
        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700/40 flex items-center justify-between text-[10px] text-slate-400">
          <span className="truncate max-w-[180px]">{item.TenLopHoc}</span>
          <span className="shrink-0">{item.TenDot}</span>
        </div>
      )}
    </div>
  )
}
