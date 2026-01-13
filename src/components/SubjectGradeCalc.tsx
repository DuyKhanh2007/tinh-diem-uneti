"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { RainbowButton } from "@/components/ui/rainbow-button"
import { Label } from "@/components/ui/label"
import { 
  BookOpen, 
  Calculator, 
  GraduationCap, 
  Hash, 
  CalendarCheck, 
  Percent, 
  Edit3, 
  FileText, 
  LineChart, 
  Medal, 
  CheckCircle2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface GradeInfo {
  id: string
  min: number
  max: number
  letter: string
  rank: string
  className: string
  range: string
}

const grades: GradeInfo[] = [
  { id: 'gradeA', min: 8.5, max: 10, letter: 'A', rank: 'Giỏi', range: '8.5 ÷ 10.0', className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400' },
  { id: 'gradeBPlus', min: 7.8, max: 8.4, letter: 'B+', rank: 'Khá giỏi', range: '7.8 ÷ 8.4', className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { id: 'gradeB', min: 7.0, max: 7.7, letter: 'B', rank: 'Khá', range: '7.0 ÷ 7.7', className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400' },
  { id: 'gradeCPlus', min: 6.3, max: 6.9, letter: 'C+', rank: 'TB khá', range: '6.3 ÷ 6.9', className: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400' },
  { id: 'gradeC', min: 5.5, max: 6.2, letter: 'C', rank: 'Trung bình', range: '5.5 ÷ 6.2', className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { id: 'gradeDPlus', min: 4.8, max: 5.4, letter: 'D+', rank: 'TB Yếu', range: '4.8 ÷ 5.4', className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400' },
  { id: 'gradeD', min: 4.0, max: 4.7, letter: 'D', rank: 'Yếu', range: '4.0 ÷ 4.7', className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400' },
  { id: 'gradeFPlus', min: 3.0, max: 3.9, letter: 'F+', rank: 'Kém', range: '3.0 ÷ 3.9', className: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400' },
  { id: 'gradeF', min: 0, max: 2.9, letter: 'F', rank: 'Rất kém', range: '0.0 ÷ 2.9', className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-400' }
]

export default function SubjectGradeCalc() {
  const [subjectName, setSubjectName] = useState('')
  const [credits, setCredits] = useState('3')
  const [attendance, setAttendance] = useState('')
  const [examScore, setExamScore] = useState('')
  const [hs1, setHs1] = useState(['', '', '', '', '', ''])
  const [hs2, setHs2] = useState(['', '', '', '', '', ''])
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({})
  const [result, setResult] = useState<{
    mauSo: number
    tbThuongKi: number
    tbMon: number
    grade: GradeInfo
  } | null>(null)

  const handleHsChange = (type: 'hs1' | 'hs2', index: number, value: string) => {
    if (type === 'hs1') {
      const newHs1 = [...hs1]
      newHs1[index] = value
      setHs1(newHs1)
    } else {
      const newHs2 = [...hs2]
      newHs2[index] = value
      setHs2(newHs2)
    }
  }

  const getHsValues = (arr: string[]) => {
    return arr
      .map(v => parseFloat(v))
      .filter(v => !isNaN(v) && v >= 0 && v <= 10)
  }

  const sumArray = (arr: number[]) => arr.reduce((a, b) => a + b, 0)

  const getGradeInfo = (tbMon: number) => {
    return grades.find(g => tbMon >= g.min && tbMon <= g.max) || grades[grades.length - 1]
  }

  const calculate = () => {
    setErrors({})
    const sName = subjectName.trim()
    const sCredits = parseInt(credits)
    const dCC = parseFloat(attendance)
    const dThi = parseFloat(examScore)
    const dsHS1 = getHsValues(hs1)
    const dsHS2 = getHsValues(hs2)

    const newErrors: { [key: string]: boolean } = {}

    if (!sName) {
      newErrors.subjectName = true
      setErrors(newErrors)
      toast.error("Vui lòng nhập tên môn học")
      return
    }
    if (isNaN(sCredits) || sCredits < 1) {
      newErrors.credits = true
      setErrors(newErrors)
      toast.error("Số tín chỉ phải từ 1 trở lên")
      return
    }
    if (isNaN(dCC) || dCC < 0 || dCC > 10) {
      newErrors.attendance = true
      setErrors(newErrors)
      toast.error("Điểm chuyên cần phải từ 0 đến 10")
      return
    }
    if (isNaN(dThi) || dThi < 0 || dThi > 10) {
      newErrors.examScore = true
      setErrors(newErrors)
      toast.error("Điểm thi phải từ 0 đến 10")
      return
    }
    
    if (dsHS1.length === 0 && dsHS2.length === 0) {
      toast.warning("Vui lòng nhập ít nhất một cột điểm quá trình")
      return
    }

    const tuSo = (dCC * sCredits) + sumArray(dsHS1) + (sumArray(dsHS2) * 2)
    const mauSo = sCredits + dsHS1.length + (dsHS2.length * 2)

    if (mauSo === 0) return

    let tbThuongKi = tuSo / mauSo
    tbThuongKi = Math.round(tbThuongKi * 100) / 100

    let tbMon = (tbThuongKi * 0.4) + (dThi * 0.6)
    tbMon = Math.round(tbMon * 10) / 10

    setResult({
      mauSo,
      tbThuongKi,
      tbMon,
      grade: getGradeInfo(tbMon)
    })
  }

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-12 max-w-7xl mx-auto">
      <div className="lg:col-span-7 xl:col-span-8 space-y-4">
        <Card className="shadow-xl border-primary/10 overflow-hidden gap-0">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b py-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-primary" />
              Nhập thông tin điểm số
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subjectName" className="flex items-center gap-2 font-semibold text-sm">
                  <BookOpen className="w-4 h-4 text-primary" /> Tên môn học
                </Label>
                <div className="relative group">
                  <Input 
                    id="subjectName" 
                    placeholder="VD: Toán Giải Tích 1" 
                    className={cn(
                      "pl-10 h-10 focus-visible:ring-primary/20 transition-all border-slate-200",
                      errors.subjectName && "border-destructive focus-visible:ring-destructive/20"
                    )}
                    value={subjectName}
                    onChange={(e) => {
                      setSubjectName(e.target.value)
                      if (errors.subjectName) setErrors(prev => ({ ...prev, subjectName: false }))
                    }}
                  />
                  <BookOpen className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 group-focus-within:text-primary transition-colors" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="credits" className="flex items-center gap-2 font-semibold text-sm">
                  <Hash className="w-4 h-4 text-primary" /> Số tín chỉ
                </Label>
                <div className="relative group">
                  <Input 
                    id="credits" 
                    type="number" 
                    placeholder="1-10" 
                    className={cn(
                      "pl-10 h-10 focus-visible:ring-primary/20 transition-all border-slate-200",
                      errors.credits && "border-destructive focus-visible:ring-destructive/20"
                    )}
                    value={credits}
                    onChange={(e) => {
                      setCredits(e.target.value)
                      if (errors.credits) setErrors(prev => ({ ...prev, credits: false }))
                    }}
                  />
                  <Hash className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 group-focus-within:text-primary transition-colors" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="attendance" className="flex items-center gap-2 font-semibold text-sm">
                <CalendarCheck className="w-4 h-4 text-primary" /> Điểm chuyên cần
              </Label>
              <div className="relative group">
                <Input 
                  id="attendance" 
                  type="number" 
                  step="0.1" 
                  placeholder="Nhập điểm từ 0-10" 
                  className={cn(
                    "pl-10 h-10 focus-visible:ring-primary/20 transition-all border-slate-200",
                    errors.attendance && "border-destructive focus-visible:ring-destructive/20"
                  )}
                  value={attendance}
                  onChange={(e) => {
                    setAttendance(e.target.value)
                    if (errors.attendance) setErrors(prev => ({ ...prev, attendance: false }))
                  }}
                />
                <Percent className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 group-focus-within:text-primary transition-colors" />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-700 dark:text-slate-300">
                    <LineChart className="w-3.5 h-3.5 text-primary" /> Quá trình (HS1)
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {hs1.map((val, i) => (
                    <Input 
                      key={`hs1-${i}`}
                      type="number" 
                      step="0.1" 
                      placeholder={`.${i+1}`}
                      className="text-center h-9 bg-white dark:bg-slate-950 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all px-1 text-sm"
                      value={val}
                      onChange={(e) => handleHsChange('hs1', i, e.target.value)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-700 dark:text-slate-300">
                    <LineChart className="w-3.5 h-3.5 text-emerald-500" /> Giữa kỳ (HS2)
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {hs2.map((val, i) => (
                    <Input 
                      key={`hs2-${i}`}
                      type="number" 
                      step="0.1" 
                      placeholder={`.${i+1}`}
                      className="text-center h-9 bg-white dark:bg-slate-950 border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all px-1 text-sm"
                      value={val}
                      onChange={(e) => handleHsChange('hs2', i, e.target.value)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="examScore" className="flex items-center gap-2 font-semibold text-sm">
                <GraduationCap className="w-4 h-4 text-orange-500" /> Điểm thi cuối kỳ (60%)
              </Label>
              <div className="relative group">
                <Input 
                  id="examScore" 
                  type="number" 
                  step="0.1" 
                  placeholder="Nhập điểm thi từ 0-10" 
                  className={cn(
                    "pl-10 h-10 focus-visible:ring-orange-500/20 focus-visible:border-orange-500 transition-all border-slate-200",
                    errors.examScore && "border-destructive focus-visible:ring-destructive/20 border-b-destructive"
                  )}
                  value={examScore}
                  onChange={(e) => {
                    setExamScore(e.target.value)
                    if (errors.examScore) setErrors(prev => ({ ...prev, examScore: false }))
                  }}
                />
                <FileText className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
              </div>
            </div>

            <RainbowButton 
              className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/10 rounded-xl group active:scale-[0.98] transition-all" 
              onClick={calculate}
            >
              <Calculator className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform" />
              TÍNH KẾT QUẢ
            </RainbowButton>
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-5 xl:col-span-4 h-fit">
        <Card className="shadow-xl border-primary/10 overflow-hidden flex flex-col gap-0 h-fit">
          <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50 py-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <LineChart className="w-4 h-4 text-primary" />
              Kết Quả
            </CardTitle>
            <div className="text-[10px] text-slate-500 font-medium">
              Môn: <span className="text-primary font-bold">{subjectName || "Chưa nhập"}</span>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex flex-col h-full">
            <div className="p-4 space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 border-b border-dashed border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-medium text-slate-500">Mẫu số chia:</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{result?.mauSo || "-"}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-dashed border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-medium text-slate-500">TB thường kì:</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{result?.tbThuongKi.toFixed(2) || "-"}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-xs font-medium text-slate-500">Điểm thi:</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{result?.tbMon.toFixed(1) || "-"}</span>
                </div>
              </div>

              <div className="relative py-4 px-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border-2 border-primary/5 text-center group overflow-hidden">
                <div className="relative z-10 space-y-1">
                  <div className="text-[10px] uppercase tracking-[0.15em] font-black text-slate-400">ĐIỂM TRUNG BÌNH:</div>
                  <div className="text-4xl font-black text-primary tracking-tighter">
                    {result ? result.tbMon.toFixed(1) : "-"}
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-125" />
              </div>
            </div>
            <div className="bg-slate-50/50 dark:bg-slate-900/50 border-y py-2.5 px-5 flex items-center gap-2">
              <Medal className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Thang Điểm & Xếp Loại</span>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-white dark:bg-slate-950 border-b text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="p-2.5 text-left pl-5">Chữ</th>
                    <th className="p-2.5 text-left">Hệ 10</th>
                    <th className="p-2.5 text-left pr-5">Xếp loại</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                  {grades.map(g => (
                    <tr key={g.id} className={cn(
                      "hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors",
                      result?.grade.id === g.id && "bg-primary/5 dark:bg-primary/10"
                    )}>
                      <td className="p-2 pl-5 font-bold text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          {g.letter}
                          {result?.grade.id === g.id && <CheckCircle2 className="w-3 h-3 text-primary" />}
                        </div>
                      </td>
                      <td className="p-2 text-slate-500">{g.range}</td>
                      <td className="p-2 pr-5">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-bold inline-block",
                          g.className.split(' ').find(c => c.startsWith('text-')),
                          g.className.split(' ').find(c => c.startsWith('bg-')) + ' bg-opacity-20'
                        )}>
                          {g.rank}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-3 border-t bg-slate-50/50 dark:bg-slate-900/30">
              <p className="text-[9px] text-slate-400 font-medium italic text-center">
                (✓) là xếp loại dựa trên điểm của bạn
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
