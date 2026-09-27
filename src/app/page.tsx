import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SubjectGradeCalc from "@/components/SubjectGradeCalc";
import GPACalc from "@/components/GPACalc";
import CPACalc from "@/components/CPACalc";
import ScheduleViewer from "@/components/ScheduleViewer";
import { Calculator, GraduationCap, BarChart3, TrendingUp, CalendarDays, ChevronRight } from "lucide-react";
import { Toaster } from "sonner";
import { SparklesText } from "@/components/ui/sparkles-text";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-3 sm:py-6 px-2 sm:px-4 md:px-6">
      <div className="relative z-10 max-w-7xl mx-auto space-y-2.5 sm:space-y-4">
        
        {/* Header Banner (Mobile Optimized) */}
        <header className="text-center space-y-1 sm:space-y-2 pt-1 sm:pt-2">
          <div className="inline-flex items-center justify-center p-2 bg-primary/10 rounded-xl mb-0.5">
            <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
          </div>
          
          <h1 className="text-xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
            <SparklesText>Cổng Lịch Học & Điểm UNETI</SparklesText>
          </h1>
          
          <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto text-xs sm:text-sm font-medium px-2">
            Tra cứu thời khóa biểu, lịch thi và tính điểm GPA/CPA chuẩn xác cho sinh viên UNETI.
          </p>
          
          <div className="group mt-1 relative mx-auto flex w-fit z-30 items-center justify-center rounded-full px-2.5 py-0.5 shadow-[inset_0_-8px_10px_#8fdfff1f] transition-shadow duration-500 ease-out hover:shadow-[inset_0_-5px_10px_#8fdfff3f]">
            <span
              className={cn(
                "animate-gradient absolute inset-0 block h-full w-full rounded-[inherit] bg-gradient-to-r from-[#ffaa40]/50 via-[#9c40ff]/50 to-[#ffaa40]/50 bg-[length:300%_100%] p-[1px]"
              )}
              style={{
                WebkitMask:
                  "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "destination-out",
                mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                maskComposite: "subtract",
                WebkitClipPath: "padding-box",
              }}
            />
            <span className="text-xs">🎉</span>
            <hr className="mx-1.5 h-3.5 w-px shrink-0 bg-slate-300 dark:bg-slate-700" />
            <AnimatedGradientText className="text-[11px] font-semibold">
              DichVuRight - DHTI19A3HN UNETI
            </AnimatedGradientText>
            <ChevronRight className="ml-0.5 size-3 stroke-slate-500 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
          </div>
        </header>
      
        {/* Navigation Tabs */}
        <Tabs defaultValue="schedule" className="w-full">
          <div className="flex justify-center mb-2.5 sm:mb-5">
            <TabsList className="grid w-full max-w-md grid-cols-4 bg-white/80 dark:bg-slate-850/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 h-9 sm:h-10 p-1 rounded-xl shadow-xs">
              <TabsTrigger
                value="schedule"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-bold gap-1 rounded-lg py-1 px-1"
              >
                <CalendarDays className="w-3.5 h-3.5 shrink-0 hidden xs:inline" />
                <span>Lịch Học</span>
              </TabsTrigger>
              <TabsTrigger
                value="subject"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-bold gap-1 rounded-lg py-1 px-1"
              >
                <Calculator className="w-3.5 h-3.5 shrink-0 hidden xs:inline" />
                <span>Môn Học</span>
              </TabsTrigger>
              <TabsTrigger
                value="gpa"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-bold gap-1 rounded-lg py-1 px-1"
              >
                <BarChart3 className="w-3.5 h-3.5 shrink-0 hidden xs:inline" />
                <span>GPA</span>
              </TabsTrigger>
              <TabsTrigger
                value="cpa"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-bold gap-1 rounded-lg py-1 px-1"
              >
                <TrendingUp className="w-3.5 h-3.5 shrink-0 hidden xs:inline" />
                <span>CPA</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="schedule"
            className="mt-0 focus-visible:outline-none"
          >
            <h2 className="sr-only">Tra cứu lịch học sinh viên UNETI</h2>
            <ScheduleViewer />
          </TabsContent>

          <TabsContent
            value="subject"
            className="mt-0 focus-visible:outline-none"
          >
            <h2 className="sr-only">Tính điểm trung bình môn học</h2>
            <SubjectGradeCalc />
          </TabsContent>

          <TabsContent value="gpa" className="mt-0 focus-visible:outline-none">
            <h2 className="sr-only">Tính điểm GPA học kỳ</h2>
            <GPACalc />
          </TabsContent>

          <TabsContent value="cpa" className="mt-0 focus-visible:outline-none">
            <h2 className="sr-only">Tính điểm CPA tích lũy</h2>
            <CPACalc />
          </TabsContent>
        </Tabs>

        <footer className="text-center text-slate-400 text-xs pt-4 pb-2">
          &copy; {new Date().getFullYear()} DichVuRight - DHTI19A3HN UNETI. All rights reserved.
        </footer>
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
        linear-gradient(45deg, transparent 49%, #e5e7eb 49%, #e5e7eb 51%, transparent 51%),
        linear-gradient(-45deg, transparent 49%, #e5e7eb 49%, #e5e7eb 51%, transparent 51%)
      `,
          backgroundSize: "40px 40px",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)",
        }}
      />
      <Toaster position="top-center" richColors />
    </main>
  );
}
