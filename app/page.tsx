"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload, Check, Download, ChevronLeft, ChevronRight,
  Send, Clock, CheckCircle, Loader, Plus, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── 타입 정의 ──────────────────────────────────────────
interface ContentType {
  id: string; label: string; icon: string; desc: string; active: boolean;
}
interface StatusConfig {
  label: string; className: string; bgClassName: string;
}
interface SlideElement {
  id: string; order: number;
  type: "heading" | "circles" | "bullets" | "emphasis" | "question" | "subtitle_text";
  text?: string; items?: string[];
}
interface Slide {
  title: string; subtitle: string; layout: string; elements: SlideElement[];
}
interface ImageDesc {
  keywords: string[];   // 추천 검색 키워드
  description: string;  // 이미지 설명
}
interface Page {
  id: number; page_id: string; course: string; week: string;
  section_name?: string;        // 원고 섹션명 (예: "강의 시작멘트")
  chapter_index: number; item_index: number;
  status: "approved" | "review" | "editing";
  slide: Slide; screen_desc: string; narration: string;
  image_desc?: ImageDesc; // 화면 설명 (선택)
}
interface IndexChapter { chapter: string; scene_no?: string; items: string[]; }

// ── 상수 ──────────────────────────────────────────────
const CONTENT_TYPES: ContentType[] = [
  { id: "elearning", label: "이러닝 콘텐츠", icon: "◈", desc: "강사PIP·슬라이드 구조", active: true },
  { id: "motion", label: "모션그래픽", icon: "✦", desc: "순차 업데이트 예정", active: false },
  { id: "promotional", label: "홍보영상", icon: "◉", desc: "순차 업데이트 예정", active: false },
  { id: "interview", label: "인터뷰영상", icon: "◎", desc: "순차 업데이트 예정", active: false },
];

const STATUS_CONFIG: Record<string, StatusConfig> = {
  approved: { label: "승인", className: "text-emerald-500", bgClassName: "bg-emerald-100" },
  review: { label: "검토 중", className: "text-amber-500", bgClassName: "bg-amber-100" },
  editing: { label: "수정 필요", className: "text-red-500", bgClassName: "bg-red-100" },
};

const HEADER_HEIGHT = 52;
const SUBBAR_HEIGHT = 38;
const PAGINATION_HEIGHT = 48;

// ── 업로드 화면 ──────────────────────────────────────
function UploadScreen({ onNext }: { onNext: (pdfText: string, fileName: string) => void }) {
  const [selectedType, setSelectedType] = useState("elearning");
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfText, setPdfText] = useState<string>("");
  const [isReading, setIsReading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setIsReading(true);
    setPdfText("");
    try {
      const text = await file.text();
      const isPdf = file.name.toLowerCase().endsWith(".pdf");
      const isTxt = file.name.toLowerCase().endsWith(".txt");

      if (isPdf && text.startsWith("%PDF")) {
        // 바이너리 PDF (이미지 기반): 텍스트 추출 불가
        setPdfText("");
        alert("이 PDF에서 텍스트를 추출할 수 없습니다.\n원고 작성 도구에서 TXT 파일로 내보내기 후 업로드해주세요.");
      } else if (isPdf && (text.includes("<!DOCTYPE") || text.includes("<html") || text.includes("<style"))) {
        // window.print() 방식으로 만든 HTML 기반 PDF → HTML 태그 제거 후 순수 텍스트만 추출
        const clean = text
          .replace(/<style[\s\S]*?<\/style>/gi, "")   // style 블록 제거
          .replace(/<script[\s\S]*?<\/script>/gi, "") // script 블록 제거
          .replace(/<[^>]+>/g, " ")                   // 나머지 태그 제거
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
          .replace(/\s{2,}/g, "\n")                   // 연속 공백 → 줄바꿈
          .trim();
        setPdfText(clean);
      } else if (isTxt) {
        // TXT 파일: 그대로 사용
        setPdfText(text);
      } else {
        setPdfText(text);
      }
    } catch {
      setPdfText("");
    } finally {
      setIsReading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <header className="h-14 bg-card border-b border-border flex items-center px-6 gap-2">
        <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-extrabold text-sm">S</div>
        <span className="font-extrabold text-[15px] text-foreground tracking-tight">StoryKit</span>
        <Badge variant="secondary" className="text-[10px] font-bold">BETA</Badge>
      </header>

      <div className="flex flex-col items-center justify-center px-6 py-16 min-h-[calc(100vh-56px)]">
        <div className="max-w-[520px] w-full">
          <div className="text-center mb-10">
            <div className="text-[11px] font-bold text-primary tracking-widest mb-3">AI STORYBOARD GENERATOR</div>
            <h1 className="text-[26px] font-extrabold text-foreground tracking-tight mb-3 leading-[1.3] text-balance">
              원고 PDF에서 스토리보드를<br />자동으로 생성하세요
            </h1>
            <p className="text-muted-foreground text-[13px] leading-relaxed">
              콘텐츠 유형별 최적화된 AI 프롬프트로<br />전문가 수준의 스토리보드를 즉시 생성합니다.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <Card
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
            onDragEnter={e => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--primary))"; (e.currentTarget as HTMLElement).style.background = "hsl(var(--secondary)/0.8)"; }}
            onDragLeave={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = ""; (e.currentTarget as HTMLElement).style.background = ""; }}
            onDrop={e => {
              e.preventDefault(); e.stopPropagation();
              (e.currentTarget as HTMLElement).style.borderColor = "";
              (e.currentTarget as HTMLElement).style.background = "";
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            className={cn(
              "border-2 border-dashed rounded-2xl p-10 text-center mb-7 cursor-pointer transition-all",
              fileName ? "border-primary bg-secondary/50" : "border-primary/30 bg-card hover:border-primary/50"
            )}
          >
            {isReading ? (
              <div className="flex items-center justify-center gap-3">
                <Loader size={18} className="animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">파일 읽는 중...</span>
              </div>
            ) : fileName ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                  <FileText size={18} className="text-primary" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-foreground text-sm">{fileName}</div>
                  <div className="text-xs text-muted-foreground">파일 선택 완료 · 클릭해서 변경</div>
                </div>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Upload size={20} className="text-primary" />
                </div>
                <div className="font-bold text-foreground text-[15px] mb-1.5">원고 PDF 업로드</div>
                <div className="text-muted-foreground text-[13px] mb-4">드래그하거나 클릭해서 파일 선택</div>
                <Button className="px-6 py-2.5 text-[13px] font-bold">파일 선택</Button>
              </>
            )}
          </Card>

          <div className="mb-7">
            <div className="text-[13px] font-bold text-foreground mb-3">콘텐츠 유형 선택</div>
            <div className="grid grid-cols-2 gap-2.5">
              {CONTENT_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => t.active && setSelectedType(t.id)}
                  disabled={!t.active}
                  className={cn(
                    "p-4 rounded-xl text-left flex items-center gap-3 transition-all relative",
                    t.active ? "cursor-pointer" : "cursor-not-allowed opacity-55",
                    selectedType === t.id
                      ? "border-2 border-primary bg-secondary"
                      : "border border-border bg-card hover:border-primary/30"
                  )}
                >
                  <span className={cn("text-xl", selectedType === t.id ? "text-primary" : "text-muted-foreground")}>{t.icon}</span>
                  <div className="flex-1">
                    <div className={cn("font-bold text-sm", selectedType === t.id ? "text-primary" : t.active ? "text-foreground" : "text-muted-foreground")}>{t.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                  </div>
                  {selectedType === t.id && <Check size={16} className="text-primary" />}
                  {!t.active && (
                    <Badge variant="outline" className="absolute top-2 right-2.5 text-[9px] font-bold">준비 중</Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          <Card className="bg-secondary/50 border-primary/20 rounded-lg p-2.5 mb-5 flex gap-2 items-start">
            <span className="text-sm mt-0.5">ℹ️</span>
            <p className="text-xs text-primary leading-relaxed">
              현재 <strong>이러닝 콘텐츠</strong> 유형이 우선 제공됩니다. 모션그래픽, 홍보영상, 인터뷰영상은 순차적으로 업데이트될 예정입니다.
            </p>
          </Card>

          <Button
            onClick={() => fileName && onNext(pdfText, fileName)}
            disabled={!fileName || isReading}
            className="w-full py-4 text-[15px] font-bold rounded-xl disabled:opacity-50"
          >
            스토리보드 생성 시작 →
          </Button>

          <div className="mt-5 flex justify-center gap-6">
            {["유형별 AI 프롬프트", "씬 자동 분할", "PDF 내보내기"].map((t, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check size={10} className="text-emerald-500" />{t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 생성 중 화면 ─────────────────────────────────────
function GeneratingScreen({
  onDone, pdfText, fileName
}: {
  onDone: (pages: Page[], index: IndexChapter[], courseTitle: string) => void;
  pdfText: string;
  fileName: string;
}) {
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("PDF 텍스트 파싱 중...");
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 8 + 2;
      if (p >= 85) { clearInterval(iv); }
      setProgress(Math.min(p, 85));
    }, 200);

    const generate = async () => {
      setStatusMsg("AI 스토리보드 생성 중...");
      try {
        const res = await fetch("/api/ai-edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdfText: pdfText || "", fileName }),
        });
        const data = await res.json();

        clearInterval(iv);
        setProgress(100);
        setStatusMsg("스토리보드 생성 완료!");

        if (data.result?.pages) {
          const pages: Page[] = data.result.pages.map((p: any, i: number) => ({
            id: i + 1,
            page_id: p.page_id || `${i + 1}`,
            course: p.course || "",
            week: p.week || "",
            chapter_index: p.chapter_index ?? i,
            item_index: p.item_index ?? 0,
            status: (p.status as Page["status"]) || "review",
            slide: {
              title: p.slide?.title || p.title || "",
              subtitle: p.slide?.subtitle || p.subtitle || "",
              layout: p.slide?.layout || p.layout || "concept",
              elements: (p.slide?.elements || p.elements || []).map((el: any, ei: number) => ({
                id: el.id || `el-${ei + 1}`,
                order: el.order ?? ei + 1,
                type: el.type || "heading",
                text: el.text || el.content || "",
                items: el.items || [],
              })),
            },
            section_name: p.section_name || "",
            screen_desc: p.screen_desc || "",
            narration: p.narration || "",
          }));
          setTimeout(() => onDone(
            pages,
            data.result.index || [],
            data.result.course_title || "AI 생성 스토리보드"
          ), 500);
        } else {
          setTimeout(() => onDone([createEmptyPage(1)], [], fileName), 500);
        }
      } catch {
        clearInterval(iv);
        setProgress(100);
        setStatusMsg("생성 완료 (기본 템플릿)");
        setTimeout(() => onDone([createEmptyPage(1)], [], fileName), 500);
      }
    };

    generate();
  }, []);

  const steps = [
    { msg: "PDF 텍스트 파싱 완료", threshold: 15 },
    { msg: "페이지 단위 구조 분석 중", threshold: 35 },
    { msg: "슬라이드 레이아웃 구성 중", threshold: 55 },
    { msg: "나레이션·자막 매핑 완료", threshold: 75 },
    { msg: "스토리보드 최종 생성 완료", threshold: 95 },
  ];

  return (
    <div className="min-h-screen bg-background font-sans flex items-center justify-center">
      <div className="text-center max-w-[360px] p-10">
        <div className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">◈</div>
        <h2 className="text-lg font-extrabold text-foreground mb-1.5 tracking-tight">스토리보드 생성 중</h2>
        <p className="text-muted-foreground text-xs mb-6">{statusMsg}</p>
        <div className="bg-muted rounded-full h-1.5 overflow-hidden mb-1.5">
          <div className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-[11px] text-muted-foreground mb-5">{Math.round(progress)}% 완료</div>
        <div className="flex flex-col gap-1.5 text-left">
          {steps.map(({ msg, threshold }, i) => (
            <div key={i} className={cn("flex items-center gap-2 text-xs transition-colors", progress >= threshold ? "text-foreground" : "text-muted-foreground")}>
              <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors", progress >= threshold ? "bg-secondary" : "bg-muted")}>
                {progress >= threshold ? <Check size={9} className="text-primary" /> : <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />}
              </div>
              {msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 빈 페이지 생성 헬퍼 ──────────────────────────────
function createEmptyPage(id: number): Page {
  return {
    id, page_id: "", course: "", week: "",
    chapter_index: -1, item_index: -1, status: "editing",
    slide: { title: "", subtitle: "", layout: "", elements: [] },
    screen_desc: "", narration: "",
    image_desc: undefined,
  };
}

// ── 강사 실루엣 SVG ──────────────────────────────────
function InstructorSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 320" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <circle cx="80" cy="52" r="38" />
      <rect x="18" y="110" width="124" height="200" rx="30" ry="30" />
    </svg>
  );
}

// ── 나레이션 #번호 마커 파싱 ─────────────────────────────
function NarrationText({ text }: { text: string }) {
  if (!text) return <span className="text-slate-400 italic">나레이션이 없습니다.</span>;
  const parts = text.split(/(#\d+)/g);
  return (
    <span>
      {parts.map((part, i) =>
        /^#\d+$/.test(part)
          ? <span key={i} className="inline-flex items-center justify-center bg-red-500 text-white font-black rounded mx-1" style={{ fontSize: "13px", padding: "1px 6px", verticalAlign: "middle", lineHeight: "18px", flexShrink: 0 }}>{part}</span>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

// ── UI 고정 폰트 상수 (모든 컴포넌트에서 공유) ────────────
const UI_XS   = "11px";   // 상태 배지, 버튼
const UI_SM   = "12px";   // 패널 라벨, caption
const UI_BASE = "13px";   // INDEX 텍스트, 헤더 값
const UI_MD   = "14px";   // 헤더 과정명/주차명 값
const UI_NAR  = "16px";   // 나레이션 본문 (바디 최소 기준)

// ── 슬라이드 콘텐츠 히어로 렌더러 ───────────────────────
function SlideHeroContent({ page, scale }: { page: Page; scale: number }) {
  const elements = page.slide.elements || [];
  const hasBulletsOrCircles = elements.some(el => el.type === "bullets" || el.type === "circles");
  const instructorRight = hasBulletsOrCircles;
  // 좌상단 소제목: index items[item_index] 우선, fallback으로 slide.subtitle
  const chapterLabel = (() => {
    // SlideView에서 indexStructure를 prop으로 받지 않으므로
    // slide.subtitle에 소제목을 저장하는 현재 방식 유지하되
    // page.slide.subtitle이 없으면 빈 문자열
    return page.slide.subtitle || "";
  })();

  // ── 슬라이드 타이포그래피 (웹디자이너 기준) ──────────────
  // sf(base, min): 화면 크기에 따라 비례하되 최소값 보장
  // base는 1080px 기준 픽셀값, scale = previewWidth/960
  const sf = (base: number, min: number) =>
    `${Math.round(Math.max(min, base * scale))}px`;
  // 레거시 호환 (padding/spacing용으로만 유지)
  const fs = (n: number) => `${Math.round(n * scale)}px`;

  // 순번 카운터 (heading은 카운트 안함)
  let markerIdx = 0;
  const getMarker = () => { markerIdx++; return markerIdx; };

  return (
    <div className="relative w-full h-full overflow-hidden bg-white select-none"
      style={{ fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" }}>
      {/* 배경 */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/20 pointer-events-none" />

      {/* 챕터명 좌상단 */}
      {chapterLabel && (
        <div className="absolute top-0 left-0 z-20 flex items-center gap-1.5 px-3 py-2">
          <div className="w-1 h-3.5 bg-red-500 rounded-full shrink-0" />
          <span className="font-bold text-slate-500" style={{ fontSize: sf(16, 12) }}>{chapterLabel}</span>
        </div>
      )}

      {/* 강사 실루엣 */}
      <div className={cn("absolute bottom-0 z-10 text-slate-200",
        instructorRight ? "right-0 w-[36%] h-[94%]" : "left-1/2 -translate-x-1/2 w-[30%] h-[90%]")}>
        <InstructorSilhouette className="w-full h-full" />
      </div>

      {/* ── 강사 중앙: 자막 하단 배치 ── */}
      {!instructorRight && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end" style={{ paddingBottom: fs(20), paddingLeft: fs(24), paddingRight: fs(24) }}>
          {elements.map((el, i) => {
            if (el.type === "heading") {
              const m = getMarker();
              return (
                <div key={i} className="flex items-start gap-2 mb-1.5 justify-center">
                  <span className="shrink-0 bg-red-500 text-white font-black rounded flex items-center justify-center" style={{ fontSize: sf(16, 10), padding: `${fs(2)} ${fs(5)}`, minWidth: fs(22), height: fs(20) }}>#{m}</span>
                  <h2 className="font-black text-slate-800 leading-tight text-center" style={{ fontSize: sf(56, 28) }}>{el.text}</h2>
                </div>
              );
            }
            if (el.type === "emphasis") {
              const m = getMarker();
              return (
                <div key={i} className="flex items-center gap-2 justify-center mb-1">
                  <span className="shrink-0 bg-red-500 text-white font-black rounded flex items-center justify-center" style={{ fontSize: sf(16, 10), padding: `${fs(2)} ${fs(5)}`, minWidth: fs(22), height: fs(20) }}>#{m}</span>
                  <div className="px-5 py-2 bg-amber-400 rounded-xl">
                    <p className="font-black text-amber-900 text-center" style={{ fontSize: sf(32, 18) }}>{el.text}</p>
                  </div>
                </div>
              );
            }
            if (el.type === "question") {
              const m = getMarker();
              return (
                <div key={i} className="flex items-center gap-2 justify-center mb-1">
                  <span className="shrink-0 bg-red-500 text-white font-black rounded flex items-center justify-center" style={{ fontSize: sf(16, 10), padding: `${fs(2)} ${fs(5)}`, minWidth: fs(22), height: fs(20) }}>#{m}</span>
                  <div className="px-5 py-2 bg-sky-500 rounded-xl">
                    <p className="font-black text-white text-center" style={{ fontSize: sf(32, 18) }}>{el.text}</p>
                  </div>
                </div>
              );
            }
            if (el.type === "subtitle_text") {
              return (
                <p key={i} className="text-center text-slate-500 font-medium mb-1" style={{ fontSize: sf(20, 13) }}>{el.text}</p>
              );
            }
            return null;
          })}
        </div>
      )}

      {/* ── 강사 우측: 좌측에 콘텐츠 배치 (히어로 섹션 스타일) ── */}
      {instructorRight && (
        <div className="absolute inset-0 z-20 flex flex-col justify-center" style={{ paddingTop: fs(28), paddingLeft: fs(20), paddingRight: `calc(38% + ${fs(12)})`, paddingBottom: fs(12) }}>
          {/* 슬라이드 제목 */}
          {page.slide.title && (
            <div style={{ marginBottom: "12px" }}>
              <h2 className="font-black text-slate-800 leading-tight" style={{ fontSize: sf(40, 22) }}>{page.slide.title}</h2>
              <div className="bg-red-500 rounded-full" style={{ width: fs(36), height: fs(3), marginTop: fs(5) }} />
            </div>
          )}

          {elements.map((el, i) => {
            if (el.type === "heading") return null;

            if (el.type === "bullets") {
              return (
                <div key={i} className="flex flex-col" style={{ gap: fs(5) }}>
                  {(el.items || []).map((item, idx) => {
                    const m = getMarker();
                    return (
                      <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-100" style={{ padding: `${fs(6)} ${fs(10)}` }}>
                        <span className="shrink-0 bg-red-500 text-white font-black rounded flex items-center justify-center" style={{ fontSize: sf(14, 10), padding: `${fs(2)} ${fs(4)}`, minWidth: fs(20), height: fs(18) }}>#{m}</span>
                        <p className="font-semibold text-slate-700 leading-snug" style={{ fontSize: sf(26, 16) }}>{item}</p>
                      </div>
                    );
                  })}
                </div>
              );
            }

            if (el.type === "circles") {
              return (
                <div key={i} className="flex flex-row" style={{ gap: fs(8) }}>
                  {(el.items || []).map((item, idx) => {
                    const m = getMarker();
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center" style={{ gap: fs(4) }}>
                        <div className="relative rounded-full border-2 border-blue-200 bg-blue-50 flex items-center justify-center" style={{ width: fs(70), height: fs(70) }}>
                          <p className="font-black text-blue-700 text-center leading-tight" style={{ fontSize: sf(22, 13) }}>{item}</p>
                          <span className="absolute -top-1.5 -left-1.5 bg-red-500 text-white font-black rounded flex items-center justify-center" style={{ fontSize: sf(13, 9), padding: `${fs(1)} ${fs(3)}`, minWidth: fs(16), height: fs(14) }}>#{m}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }

            if (el.type === "emphasis") {
              const m = getMarker();
              return (
                <div key={i} className="flex items-start gap-2 rounded-r-xl" style={{ marginTop: fs(6), padding: `${fs(6)} ${fs(10)}`, borderLeft: `${fs(4)} solid #f59e0b`, background: "rgba(251,191,36,0.12)" }}>
                  <span className="shrink-0 bg-red-500 text-white font-black rounded flex items-center justify-center mt-0.5" style={{ fontSize: sf(14, 10), padding: `${fs(2)} ${fs(4)}`, minWidth: fs(20), height: fs(18) }}>#{m}</span>
                  <p className="font-bold text-amber-800 leading-relaxed" style={{ fontSize: sf(24, 14) }}>{el.text}</p>
                </div>
              );
            }

            if (el.type === "question") {
              const m = getMarker();
              return (
                <div key={i} className="flex items-start gap-2 rounded-r-xl" style={{ marginTop: fs(6), padding: `${fs(6)} ${fs(10)}`, borderLeft: `${fs(4)} solid #38bdf8`, background: "rgba(56,189,248,0.10)" }}>
                  <span className="shrink-0 bg-red-500 text-white font-black rounded flex items-center justify-center mt-0.5" style={{ fontSize: sf(14, 10), padding: `${fs(2)} ${fs(4)}`, minWidth: fs(20), height: fs(18) }}>#{m}</span>
                  <p className="font-bold text-sky-800 leading-relaxed" style={{ fontSize: sf(24, 14) }}>{el.text}</p>
                </div>
              );
            }

            if (el.type === "subtitle_text") {
              return (
                <p key={i} className="text-slate-500 font-medium leading-relaxed" style={{ fontSize: sf(18, 13), marginTop: fs(4) }}>{el.text}</p>
              );
            }

            return null;
          })}
        </div>
      )}

      {/* 화면 설명 (우하단) */}
      {page.screen_desc && (
        <div className="absolute bottom-2 right-3 z-30">
          <span className="font-bold text-slate-400 bg-white/80 rounded" style={{ fontSize: UI_SM, padding: "3px 8px" }}>{page.screen_desc}</span>
        </div>
      )}
    </div>
  );
}

// ── 슬라이드 뷰 ──────────────────────────────────────
function SlideView({
  page, onUpdate, slideWidth, indexStructure
}: {
  page: Page; onUpdate: (page: Page) => void;
  slideWidth: number; indexStructure: IndexChapter[];
}) {
  // ── 레퍼런스 치수 기반 레이아웃 (Image2: 1480px 기준)
  // INDEX(200px=13.51%) | PREVIEW(1080px=72.97%) | DESC(200px=13.51%)
  // 높이: 헤더(60px) | 미리보기(600px) | 나레이션(176px)
  const REF_TOTAL   = 1480;  // 레퍼런스 전체 폭
  const REF_PREVIEW = 1080;  // 레퍼런스 미리보기 폭
  const REF_IDX     = 200;   // 레퍼런스 INDEX 폭
  const REF_DESC    = 200;   // 레퍼런스 DESC 폭
  const REF_PREV_H  = 600;   // 레퍼런스 미리보기 높이 (16:9 기준)
  const REF_HDR_H   = 50;    // 헤더 높이 (50px 기준)
  const REF_NAR_H   = 176;   // 레퍼런스 나레이션 높이

  // slideWidth 기준 scale factor
  const scaleFactor = slideWidth / REF_TOTAL;

  // 각 영역 폭 계산 (min/max 클램프 적용)
  const indexWidth   = Math.round(Math.min(260, Math.max(120, REF_IDX  * scaleFactor)));
  const descWidth    = Math.round(Math.min(260, Math.max(120, REF_DESC * scaleFactor)));
  const previewWidth = slideWidth - indexWidth - descWidth;  // 나머지 전부

  // scale: previewWidth 기준 (콘텐츠 렌더링용)
  // ── 타이포그래피 시스템 (웹디자이너 기준) ──────────────────
  // 슬라이드 콘텐츠(강사화면) scale — 레이아웃 비례용
  const scale = previewWidth / 960;
  // 레이아웃 높이 전용 scale (레퍼런스 1080 기준)
  const layoutScale = previewWidth / REF_PREVIEW;

  // 슬라이드 내부 텍스트: clamp(min, preferred, max)
  // preferred = n * (previewWidth / 1080) * 100 + "cqw" 대신 px 계산
  const slideFont = (base: number, minPx = base * 0.5) =>
    `${Math.round(Math.max(minPx, base * layoutScale))}px`;

  // UI 상수는 모듈 최상단에 정의됨 (UI_XS ~ UI_NAR)

  // 하위 호환: SlideHeroContent로 전달하는 scale용 fs
  const fs = (n: number) => `${Math.round(n * scale)}px`;

  // 높이 계산 (레퍼런스 비율 그대로 scale)
  const previewH = Math.round(REF_PREV_H * layoutScale);   // ≈ previewW * 0.5556
  const hdrH     = Math.round(Math.max(32, REF_HDR_H  * layoutScale));   // min 32px
  const narH     = Math.round(Math.max(80, REF_NAR_H  * layoutScale));   // min 80px

  // 화면 설명 편집 핸들러
  const updateKeyword = (idx: number, val: string) => {
    const kws = [...(page.image_desc?.keywords || ["", "", ""])];
    kws[idx] = val;
    onUpdate({ ...page, image_desc: { keywords: kws, description: page.image_desc?.description || "" } });
  };
  const updateDescription = (val: string) => {
    onUpdate({ ...page, image_desc: { keywords: page.image_desc?.keywords || ["", "", ""], description: val } });
  };
  const hasImageDesc = !!(page.image_desc?.keywords?.some(k => k.trim()) || page.image_desc?.description?.trim());
  const toggleImageDesc = () => {
    if (hasImageDesc) {
      onUpdate({ ...page, image_desc: undefined });
    } else {
      onUpdate({ ...page, image_desc: { keywords: ["", "", ""], description: "" } });
    }
  };

  return (
    <div className="border border-slate-300 bg-white flex flex-col overflow-hidden rounded-lg shadow-sm"
      style={{ width: slideWidth }}>

      {/* ── 메타 헤더 (전체 폭, 분리 없음) ── */}
      <div className="flex items-stretch border-b shrink-0 bg-white" style={{ height: hdrH, minHeight: 32, borderBottomColor: "#E8E8E8" }}>
        {/* 과정명 40% */}
        <div className="flex items-stretch border-r" style={{ width: "40%", borderRightColor: "#E8E8E8" }}>
          <div className="font-semibold whitespace-nowrap flex items-center shrink-0"
            style={{ fontSize: UI_SM, padding: "0 10px", background: "#F3F3F3", color: "#1D293D" }}>과정명</div>
          <div className="flex items-center overflow-hidden px-3 font-medium" style={{ fontSize: UI_MD, color: "#1D293D" }}>
            <span className="truncate">{page.course || "—"}</span>
          </div>
        </div>
        {/* 섹션명(대주제) 32% */}
        <div className="flex items-stretch border-r" style={{ width: "32%", borderRightColor: "#E8E8E8" }}>
          <div className="font-semibold whitespace-nowrap flex items-center shrink-0"
            style={{ fontSize: UI_SM, padding: "0 10px", background: "#F3F3F3", color: "#1D293D" }}>섹션</div>
          <div className="flex items-center overflow-hidden px-3 font-medium" style={{ fontSize: UI_MD, color: "#1D293D" }}>
            <span className="truncate">{page.section_name || page.week || "—"}</span>
          </div>
        </div>
        {/* 페이지 — 라벨+번호 */}
        <div className="flex items-stretch border-r" style={{ width: "14%", borderRightColor: "#E8E8E8" }}>
          <div className="font-semibold whitespace-nowrap flex items-center shrink-0"
            style={{ fontSize: UI_SM, padding: "0 10px", background: "#F3F3F3", color: "#1D293D" }}>페이지</div>
          <div className="flex items-center overflow-hidden px-3 font-bold" style={{ fontSize: UI_MD, color: "#1D293D" }}>
            <span>{page.page_id || "—"}</span>
          </div>
        </div>
        {/* 상태 버튼 (분리 없이 우측 정렬) */}
        <div className="flex items-center gap-1.5 flex-1 px-3">
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <button key={k}
              onClick={() => onUpdate({ ...page, status: k as Page["status"] })}
              className={cn(
                "rounded-full font-semibold border transition-all whitespace-nowrap",
                page.status === k
                  ? cn(v.bgClassName, v.className, "border-current")
                  : "border-slate-200 text-slate-400 hover:border-slate-300"
              )}
              style={{ fontSize: UI_XS, padding: "3px 10px" }}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 바디: INDEX | 미리보기 | 화면설명 ── */}
      <div className="flex shrink-0" style={{ height: previewH }}>

        {/* INDEX */}
        <div className="border-r border-slate-200 shrink-0 overflow-y-auto bg-slate-50/60"
          style={{ width: indexWidth }}>
          {indexStructure.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <span className="text-slate-300" style={{ fontSize: UI_SM }}>목차 없음</span>
            </div>
          ) : indexStructure.map((ch, ci) => (
            <div key={ci}>
              {/* 섹션명 헤더: 섹션명만 표시 */}
              <div className="bg-slate-700 text-white font-semibold flex items-center"
                style={{ fontSize: UI_SM, padding: "5px 8px" }}>
                <span className="truncate">{ch.chapter}</span>
              </div>
              {/* 소주제 목록 */}
              {ch.items.map((item, ii) => {
                const active = ci === page.chapter_index && ii === page.item_index;
                return (
                  <div key={ii}
                    className={cn(
                      "flex items-start gap-1.5 transition-colors",
                      active
                        ? "bg-red-50 text-slate-800 font-bold border-l-2 border-red-500"
                        : "text-slate-400 border-l-2 border-transparent hover:text-slate-600"
                    )}
                    style={{ fontSize: UI_BASE, padding: "4px 8px" }}>
                    <span className="shrink-0 text-slate-300 mt-0.5" style={{ fontSize: "9px" }}>▸</span>
                    <span className="leading-snug">{item}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* 미리보기 (히어로 콘텐츠) */}
        <div className="shrink-0 overflow-hidden" style={{ width: previewWidth, height: previewH }}>
          <SlideHeroContent page={page} scale={scale} />
        </div>

        {/* 화면 설명 패널 — AI 이미지 키워드 (항상 표시) */}
        <div className="border-l border-slate-200 shrink-0 flex flex-col overflow-hidden bg-slate-50/30"
          style={{ width: descWidth }}>
          <div className="flex flex-col h-full overflow-y-auto" style={{ padding: "10px 10px" }}>

            {/* 섹션 헤더 */}
            <div className="flex items-center gap-1.5 shrink-0 mb-2">
              <div className="w-1 h-3 bg-slate-400 rounded-full shrink-0" />
              <span className="font-semibold text-slate-500" style={{ fontSize: UI_SM }}>이미지</span>
            </div>
            <div className="w-full border-t border-slate-100 shrink-0 mb-2" />

            {/* 추천 검색 키워드 */}
            <div className="shrink-0 mb-3">
              <div className="text-slate-400 font-medium mb-1.5" style={{ fontSize: "11px" }}>추천 검색 키워드</div>
              {(page.image_desc?.keywords || ["", "", ""]).map((kw, ki) => (
                <div key={ki} className="flex items-center mb-1">
                  <span className="text-slate-300 shrink-0 font-mono text-xs mr-0.5">[</span>
                  <input
                    value={kw}
                    onChange={e => updateKeyword(ki, e.target.value)}
                    placeholder={`키워드 ${ki + 1}`}
                    className="flex-1 bg-white border border-slate-200 rounded text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 min-w-0 transition-all"
                    style={{ fontSize: UI_SM, padding: "3px 6px" }}
                  />
                  <span className="text-slate-300 shrink-0 font-mono text-xs ml-0.5">]</span>
                </div>
              ))}
            </div>

            {/* 이미지 설명 */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="text-slate-400 font-medium mb-1.5 shrink-0" style={{ fontSize: "11px" }}>이미지 설명</div>
              <textarea
                value={page.image_desc?.description || ""}
                onChange={e => updateDescription(e.target.value)}
                placeholder={"이미지 내용을 설명합니다"}
                className="flex-1 w-full bg-white border border-slate-200 rounded text-slate-600 resize-none outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 leading-relaxed transition-all"
                style={{ fontSize: UI_SM, padding: "6px 8px", minHeight: "60px" }}
              />
            </div>

            {/* 내용 삭제 버튼 */}
            {hasImageDesc && (
              <button
                onClick={toggleImageDesc}
                className="mt-2 shrink-0 w-full rounded border border-red-100 text-red-300 hover:text-red-400 hover:border-red-200 transition-all font-medium"
                style={{ fontSize: "11px", padding: "4px 0" }}>
                내용 삭제
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 나레이션 (전체 폭, 분리 없음) ── */}
      <div className="flex border-t border-slate-200 shrink-0 bg-white" style={{ height: narH }}>
        {/* 나레이션 라벨 */}
        <div className="bg-slate-800 flex items-center justify-center shrink-0"
          style={{ width: Math.round(32 * scale), height: narH }}>
          <span className="text-white font-bold tracking-widest select-none"
            style={{ fontSize: UI_SM, writingMode: "vertical-rl", letterSpacing: "0.15em" }}>나레이션</span>
        </div>
        {/* 나레이션 텍스트 — 전체 폭(라벨 제외) */}
        <div className="flex-1 leading-relaxed text-slate-600 overflow-y-auto"
          style={{
            fontSize: UI_NAR,
            padding: "14px 20px",
            lineHeight: 1.7,
          }}>
          <NarrationText text={page.narration} />
        </div>
      </div>
    </div>
  );
}

// ── AI 패널 ───────────────────────────────────────────
interface AiStep { label: string; status: "pending" | "loading" | "done"; }
interface AiHistoryItem {
  id: number;
  request: string;
  summary: string;
  timestamp: string;
}

function AiPanel({
  collapsed, onToggle, currentPage, width, onApply
}: {
  collapsed: boolean; onToggle: () => void;
  currentPage: Page; width: number;
  onApply: (slide: Slide, narration: string) => void;
}) {
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [steps, setSteps] = useState<AiStep[]>([]);
  const [history, setHistory] = useState<AiHistoryItem[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const historyIdRef = useRef(0);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [steps, history]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    const userRequest = input.trim();
    setInput("");
    setIsProcessing(true);
    setSteps([
      { label: "요청 분석 중...", status: "loading" },
      { label: "슬라이드 구조 파악 중...", status: "pending" },
      { label: "수정 사항 적용 중...", status: "pending" },
    ]);

    await new Promise(r => setTimeout(r, 600));
    setSteps(s => s.map((st, i) => i === 0 ? { ...st, status: "done" } : i === 1 ? { ...st, status: "loading" } : st));
    await new Promise(r => setTimeout(r, 600));
    setSteps(s => s.map((st, i) => i <= 1 ? { ...st, status: "done" } : { ...st, status: "loading" }));

    try {
      const res = await fetch("/api/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userRequest,
          slideContext: {
            title: currentPage.slide.title,
            subtitle: currentPage.slide.subtitle,
            narration: currentPage.narration,
            screen_desc: currentPage.screen_desc,
            elements: currentPage.slide.elements,
          },
        }),
      });

      const data = await res.json();
      setSteps(s => s.map(st => ({ ...st, status: "done" })));
      await new Promise(r => setTimeout(r, 300));

      const summary = data.result?.summary || "수정이 적용되었습니다.";
      if (data.result?.slide) {
        // slide 구조 정규화 (AI 응답 필드명 불일치 방어)
        const rawSlide = data.result.slide;
        const normalizedSlide: Slide = {
          title: rawSlide.title || currentPage.slide.title,
          subtitle: rawSlide.subtitle || currentPage.slide.subtitle,
          layout: rawSlide.layout || currentPage.slide.layout,
          elements: (rawSlide.elements || []).map((el: any, ei: number) => ({
            id: el.id || `el-${ei + 1}`,
            order: el.order ?? ei + 1,
            type: el.type || "heading",
            text: el.text || el.content || "",
            items: el.items || [],
          })),
        };
        onApply(normalizedSlide, data.result.narration || currentPage.narration);
      } else if (data.result?.narration) {
        // slide 없이 narration만 수정된 경우
        onApply(currentPage.slide, data.result.narration);
      }

      const now = new Date();
      const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      setHistory(h => [...h, { id: ++historyIdRef.current, request: userRequest, summary, timestamp }]);

    } catch {
      setHistory(h => [...h, {
        id: ++historyIdRef.current,
        request: userRequest,
        summary: "오류가 발생했습니다. 다시 시도해주세요.",
        timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      }]);
    }

    setSteps([]);
    setIsProcessing(false);
  };

  if (collapsed) return (
    <div className="w-9 bg-card border-r border-border flex flex-col items-center pt-3 shrink-0">
      <Button variant="ghost" size="icon" onClick={onToggle} className="text-primary h-7 w-7">
        <ChevronRight size={16} />
      </Button>
      <div className="mt-4 text-[10px] font-bold text-muted-foreground tracking-wider" style={{ writingMode: "vertical-rl" }}>AI</div>
    </div>
  );

  return (
    <div className="bg-card border-r border-border flex flex-col shrink-0 h-full" style={{ width }}>
      {/* 헤더 */}
      <div className="px-3.5 py-2.5 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-primary">✦</span>
          <span className="font-bold text-[13px] text-foreground">AI 수정 요청</span>
        </div>
        <div className="flex items-center gap-1">
          {history.length > 0 && (
            <button onClick={() => setHistory([])}
              className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors">
              기록 삭제
            </button>
          )}
          <button onClick={onToggle} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>

      {/* 히스토리 영역 (스크롤, 상단) */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5 min-h-0">
        {history.length === 0 && !isProcessing && (
          <div className="flex flex-col items-center justify-center h-full gap-2 pb-6">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg opacity-50">💡</div>
            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              현재 슬라이드에 대한<br />수정 요청을 입력하세요.
            </p>
          </div>
        )}

        {history.map(item => (
          <div key={item.id} className="flex flex-col gap-1.5">
            {/* 사용자 말풍선 (우측) */}
            <div className="flex justify-end">
              <div className="bg-slate-800 text-white rounded-2xl rounded-tr-sm px-3 py-2 max-w-[86%] shadow-sm">
                <p className="text-[11px] leading-relaxed">{item.request}</p>
              </div>
            </div>
            {/* AI 응답 말풍선 (좌측) */}
            <div className="flex justify-start items-start gap-1.5">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[8px] font-black text-primary">AI</span>
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2 max-w-[82%] shadow-sm">
                <div className="flex items-center gap-1 mb-1">
                  <CheckCircle size={9} className="text-emerald-500 shrink-0" />
                  <span className="text-[10px] font-semibold text-emerald-600">적용 완료</span>
                  <span className="text-[9px] text-muted-foreground ml-1">{item.timestamp}</span>
                </div>
                <p className="text-[11px] text-foreground leading-relaxed">{item.summary}</p>
              </div>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start items-start gap-1.5">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[8px] font-black text-primary">AI</span>
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2.5 shadow-sm">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5 last:mb-0">
                  {step.status === "loading" ? <Loader size={11} className="text-primary animate-spin shrink-0" />
                    : step.status === "done" ? <CheckCircle size={11} className="text-emerald-500 shrink-0" />
                    : <Clock size={11} className="text-muted-foreground/50 shrink-0" />}
                  <span className={cn("text-[11px]",
                    step.status === "done" ? "text-muted-foreground line-through" : step.status === "loading" ? "text-primary font-medium" : "text-muted-foreground/50")}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 (하단 고정) */}
      <div className="shrink-0 border-t border-border bg-card" style={{ padding: "12px 12px 18px" }}>
        <div className="flex gap-2 items-end">
          <Textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="수정할 내용을 입력하세요..." rows={2} disabled={isProcessing}
            className="flex-1 px-2.5 py-2 border border-border rounded-xl text-xs resize-none focus-visible:ring-0 focus-visible:border-slate-400 leading-relaxed disabled:opacity-50 bg-background" />
          <button onClick={handleSend} disabled={!input.trim() || isProcessing}
            className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all",
              input.trim() && !isProcessing
                ? "bg-slate-800 text-white hover:bg-slate-700 shadow-sm"
                : "bg-muted text-muted-foreground cursor-not-allowed")}>
            <Send size={13} />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">Enter: 전송 &nbsp;·&nbsp; Shift+Enter: 줄바꿈</p>
      </div>
    </div>
  );
}

// ── 에디터 메인 ──────────────────────────────────────
function EditorScreen({
  initialPages, initialIndex, courseTitle
}: {
  initialPages: Page[];
  initialIndex: IndexChapter[];
  courseTitle: string;
}) {
  const [pages, setPages] = useState<Page[]>(initialPages);
  const [indexStructure] = useState<IndexChapter[]>(initialIndex);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [viewMode, setViewMode] = useState<"single" | "grid4">("single");
  const [aiCollapsed, setAiCollapsed] = useState(false);
  const [aiPanelWidth, setAiPanelWidth] = useState(280);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const slideAreaRef = useRef<HTMLDivElement>(null);
  const [slideWidth, setSlideWidth] = useState(800);

  useEffect(() => {
    const calc = () => {
      if (!slideAreaRef.current) return;
      const aw = slideAreaRef.current.clientWidth;
      const ah = window.innerHeight - HEADER_HEIGHT - SUBBAR_HEIGHT;
      const byW = aw - 48; // 좌우 패딩(24px × 2)

      // 레퍼런스(1480px) 기준 전체 높이 비율:
      // 헤더:     60/1480 = 0.0405
      // 미리보기: 600/1480 = 0.4054  (scale에 따라)
      // 나레이션: 176/1480 = 0.1189
      // → 합계 slideW * (0.0405 + 0.4054 + 0.1189) = slideW * 0.5648
      // → 최소 헤더(32px), 최소 나레이션(80px) 때문에 소형에서 오차 있음
      // 페이지네이션(48) + 상하여백(30) + 여유(6) = 84px
      const verticalFixed = PAGINATION_HEIGHT + 30 + 6; // 84
      const availH = ah - verticalFixed;
      // slideW * 0.5648 <= availH → slideW <= availH / 0.5648
      const byH = Math.floor(availH / 0.5648);
      // min=740(레퍼런스 50%), max=1924(레퍼런스 130%)
      setSlideWidth(Math.max(740, Math.min(byW, byH, 1924)));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [aiPanelWidth, aiCollapsed]);

  // ── PDF 내보내기 ──────────────────────────────────────────
  const exportPDF = () => {
    const sectionMap: Record<string, string[]> = {};
    pages.forEach(p => {
      const key = p.section_name || p.week || "—";
      if (!sectionMap[key]) sectionMap[key] = [];
    });

    const pagesHtml = pages.map((p, idx) => {
      const elems = p.slide.elements || [];
      const heading = elems.find(e => e.type === "heading")?.text || "";
      const subtitle = p.slide.subtitle || "";
      const bullets = elems.filter(e => e.type === "bullets").flatMap(e => e.items || []);
      const circles = elems.filter(e => e.type === "circles").flatMap(e => e.items || []);
      const emphasis = elems.find(e => e.type === "emphasis")?.text || "";
      const question = elems.find(e => e.type === "question")?.text || "";

      const statusColor = p.status === "approved" ? "#1A7F45" : p.status === "review" ? "#B45309" : "#666";
      const statusLabel = p.status === "approved" ? "승인" : p.status === "review" ? "검토 중" : "수정 필요";

      const bulletsHtml = bullets.length > 0
        ? `<ul class="bullets">${bullets.map((b, i) => `<li><span class="num">${i + 1}</span>${b}</li>`).join("")}</ul>` : "";
      const circlesHtml = circles.length > 0
        ? `<div class="circles">${circles.map((c, i) => `<div class="circle"><span class="cnum">${i + 1}</span><span>${c}</span></div>`).join("")}</div>` : "";

      return `
      <div class="slide-page">
        <div class="slide-header">
          <span class="course">${p.course || courseTitle}</span>
          <span class="section">${p.section_name || p.week || "—"}</span>
          <span class="pagenum">p.${idx + 1} / ${pages.length}</span>
          <span class="status" style="color:${statusColor}">${statusLabel}</span>
        </div>
        <div class="slide-body">
          <div class="preview">
            ${subtitle ? `<div class="sub-label"><span class="bar"></span>${subtitle}</div>` : ""}
            ${question ? `<div class="question">${question}</div>` : ""}
            ${heading ? `<div class="heading">${heading}</div>` : ""}
            ${emphasis ? `<div class="emphasis">${emphasis}</div>` : ""}
            ${bulletsHtml}
            ${circlesHtml}
            ${p.screen_desc ? `<div class="screen-desc">📷 ${p.screen_desc}</div>` : ""}
          </div>
        </div>
        <div class="narration">${(p.narration || "").replace(/\n/g, "<br>").replace(/#(\d+)/g, '<span class="nar-badge">#$1</span>')}</div>
      </div>`
    }).join("")

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${courseTitle || "스토리보드"} - StoryKit</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Noto Sans KR','Malgun Gothic',sans-serif; background:#fff; color:#1C1C1E; font-size:11px; }
  .slide-page { width:100%; border-bottom:2px solid #E5E5E5; padding:12px 16px 10px; page-break-after:always; }
  .slide-page:last-child { border-bottom:none; page-break-after:auto; }

  /* 헤더 */
  .slide-header { display:flex; align-items:center; gap:8px; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid #F0F0F0; }
  .course { font-weight:700; color:#1C1C1E; font-size:12px; }
  .section { color:#6C5CE7; font-weight:700; font-size:11px; flex:1; }
  .pagenum { color:#999; font-size:10px; }
  .status { font-size:10px; font-weight:700; }

  /* 슬라이드 본문 */
  .slide-body { background:#F8F8FC; border-radius:8px; padding:14px 16px; min-height:120px; margin-bottom:8px; position:relative; }
  .sub-label { display:flex; align-items:center; gap:5px; color:#64748B; font-size:10px; font-weight:700; margin-bottom:8px; }
  .sub-label .bar { width:3px; height:12px; background:#EF4444; border-radius:2px; }
  .question { font-size:16px; font-weight:900; color:#1C1C1E; line-height:1.4; margin-bottom:6px; }
  .heading { font-size:18px; font-weight:900; color:#1C1C1E; line-height:1.3; margin-bottom:8px; }
  .emphasis { font-size:14px; font-weight:700; color:#6C5CE7; margin-top:6px; }
  .screen-desc { font-size:9px; color:#94A3B8; margin-top:8px; }

  /* 불릿/서클 */
  .bullets { list-style:none; margin-top:6px; }
  .bullets li { display:flex; align-items:flex-start; gap:6px; margin-bottom:4px; font-size:11px; color:#334155; }
  .bullets .num { background:#6C5CE7; color:#fff; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:700; flex-shrink:0; margin-top:1px; }
  .circles { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
  .circle { display:flex; flex-direction:column; align-items:center; gap:3px; }
  .circle .cnum { background:#EF4444; color:#fff; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; }
  .circle span:last-child { font-size:9px; color:#334155; font-weight:700; text-align:center; max-width:52px; }

  /* 나레이션 */
  .narration { background:#fff; border:1px solid #E5E5E5; border-radius:6px; padding:8px 12px; font-size:11px; line-height:1.8; color:#333; word-break:keep-all; }
  .nar-badge { background:#EF4444; color:#fff; border-radius:3px; padding:1px 4px; font-size:9px; font-weight:700; margin-right:2px; }

  @media print {
    body { font-size:10px; }
    .slide-page { padding:10px 14px 8px; }
    .heading { font-size:16px; }
    .question { font-size:14px; }
    @page { margin:12mm 10mm; size:A4; }
  }
</style>
</head>
<body>
  ${pagesHtml}
  <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};}<\/script>
</body>
</html>`

    const win = window.open("", "_blank", "width=960,height=700")
    if (win) { win.document.write(html); win.document.close(); }
  };

  const handleMouseDown = useCallback(() => setIsDragging(true), []);
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    setAiPanelWidth(Math.max(240, Math.min(e.clientX - r.left, r.width * 0.4)));
  }, [isDragging]);
  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const updatePage = (updated: Page) => setPages(p => p.map(pg => pg.id === updated.id ? updated : pg));
  const currentPage = pages[currentIdx];
  const stats = {
    approved: pages.filter(p => p.status === "approved").length,
    review: pages.filter(p => p.status === "review").length,
    editing: pages.filter(p => p.status === "editing").length,
  };

  return (
    <div className="h-screen flex flex-col font-sans bg-muted overflow-hidden">
      {/* 헤더 */}
      <header className="bg-card border-b border-border flex items-center px-4 gap-2.5 shrink-0" style={{ height: HEADER_HEIGHT }}>
        <div className="w-6 h-6 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-extrabold text-[13px]">S</div>
        <span className="font-extrabold text-sm text-foreground tracking-tight">StoryKit</span>
        <div className="w-px h-4 bg-border" />
        <span className="text-xs text-muted-foreground">{courseTitle}</span>
        <Badge variant="secondary" className="text-[10px] font-bold">이러닝 콘텐츠</Badge>
        <div className="ml-auto flex items-center gap-1.5">
          {[{ k: "approved", l: "승인" }, { k: "review", l: "검토" }, { k: "editing", l: "수정" }].map(({ k, l }) => (
            <Badge key={k} className={cn(STATUS_CONFIG[k].bgClassName, STATUS_CONFIG[k].className, "text-[11px] font-bold")}>
              {stats[k as keyof typeof stats]} {l}
            </Badge>
          ))}
          <div className="w-px h-4 bg-border" />
          <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
            {["single", "grid4"].map(m => (
              <Button key={m} variant="ghost" size="sm"
                onClick={() => setViewMode(m as "single" | "grid4")}
                className={cn("px-2.5 py-1 text-[11px] font-semibold rounded-md h-auto",
                  viewMode === m ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>
                {m === "single" ? "1페이지" : "4페이지"}
              </Button>
            ))}
          </div>
          <Button size="sm" className="text-xs font-bold gap-1" onClick={exportPDF}>
            <Download size={12} />PDF 내보내기
          </Button>
        </div>
      </header>

      {/* 서브바 */}
      <div className="bg-card border-b border-muted flex items-center px-4 gap-3.5 text-xs text-muted-foreground shrink-0" style={{ height: SUBBAR_HEIGHT }}>
        <span>총 <strong className="text-foreground">{pages.length}페이지</strong></span>
        <span className="text-border">·</span>
        <span>검수율 <strong className="text-emerald-500">{pages.length > 0 ? Math.round(stats.approved / pages.length * 100) : 0}%</strong></span>
        <span className="text-border">·</span>
        <span className="text-primary text-[11px]">💡 나레이션 수정은 AI 수정 요청을 이용하세요</span>
        <Button variant="outline" size="sm" className="ml-auto text-[11px] font-semibold gap-1 h-7"
          onClick={() => setPages(p => [...p, { ...createEmptyPage(p.length + 1) }])}>
          <Plus size={10} />페이지 추가
        </Button>
      </div>

      {/* 바디 */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        <AiPanel
          collapsed={aiCollapsed}
          onToggle={() => setAiCollapsed(c => !c)}
          currentPage={currentPage}
          width={aiPanelWidth}
          onApply={(slide, narration) => updatePage({ ...currentPage, slide, narration })}
        />

        {!aiCollapsed && (
          <div onMouseDown={handleMouseDown}
            className={cn("w-1 cursor-ew-resize transition-colors shrink-0 hover:bg-primary", isDragging ? "bg-primary" : "bg-border")} />
        )}

        {/* 슬라이드 영역: 상단 슬라이드 + 하단 페이지네이션 고정 */}
        <div ref={slideAreaRef} className="flex-1 flex flex-col overflow-hidden">
          {viewMode === "single" ? (
            <>
              {/* 슬라이드 스크롤 가능 영역 */}
              <div className="flex-1 overflow-y-auto flex flex-col items-center" style={{ padding: "14px 24px 16px" }}>
                <SlideView page={currentPage} onUpdate={updatePage} slideWidth={slideWidth} indexStructure={indexStructure} />
              </div>
              {/* 페이지네이션 - 항상 하단 고정 */}
              <div className="shrink-0 flex items-center justify-center gap-2 border-t border-slate-200 bg-white/90 backdrop-blur-sm" style={{ height: PAGINATION_HEIGHT, paddingBottom: 10 }}>
                <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-30 hover:border-slate-400 transition-all">
                  <ChevronLeft size={13} />이전
                </button>
                <div className="flex gap-1 flex-wrap justify-center" style={{ maxWidth: 500 }}>
                  {pages.map((_, i) => (
                    <button key={i} onClick={() => setCurrentIdx(i)}
                      className={cn("w-7 h-7 rounded-lg text-xs font-bold transition-all border",
                        i === currentIdx
                          ? "bg-slate-800 text-white border-slate-800"
                          : "bg-white text-slate-500 border-slate-200 hover:border-slate-400")}>
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button onClick={() => setCurrentIdx(i => Math.min(pages.length - 1, i + 1))} disabled={currentIdx === pages.length - 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-30 hover:border-slate-400 transition-all">
                  다음<ChevronRight size={13} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 grid grid-cols-2 gap-4 overflow-auto p-4 content-start">
              {pages.slice(0, 4).map((p, i) => (
                <div key={p.id} className="cursor-pointer hover:ring-2 hover:ring-primary rounded-lg transition-all"
                  onClick={() => { setCurrentIdx(i); setViewMode("single"); }}>
                  <SlideView page={p} onUpdate={updatePage} slideWidth={slideWidth / 2 - 8} indexStructure={indexStructure} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 메인 앱 ──────────────────────────────────────────
export default function StoryKitApp() {
  const [step, setStep] = useState<"upload" | "generating" | "editor">("upload");
  const [pdfText, setPdfText] = useState("");
  const [fileName, setFileName] = useState("");
  const [generatedPages, setGeneratedPages] = useState<Page[]>([]);
  const [generatedIndex, setGeneratedIndex] = useState<IndexChapter[]>([]);
  const [courseTitle, setCourseTitle] = useState("");

  if (step === "upload") return (
    <UploadScreen onNext={(text, name) => {
      setPdfText(text);
      setFileName(name);
      setStep("generating");
    }} />
  );

  if (step === "generating") return (
    <GeneratingScreen
      pdfText={pdfText}
      fileName={fileName}
      onDone={(pages, index, title) => {
        setGeneratedPages(pages);
        setGeneratedIndex(index);
        setCourseTitle(title);
        setStep("editor");
      }}
    />
  );

  return (
    <EditorScreen
      initialPages={generatedPages}
      initialIndex={generatedIndex}
      courseTitle={courseTitle}
    />
  );
}
