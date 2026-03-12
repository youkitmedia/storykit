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
interface Page {
  id: number; page_id: string; course: string; week: string;
  chapter_index: number; item_index: number;
  status: "approved" | "review" | "editing";
  slide: Slide; screen_desc: string; narration: string;
}
interface IndexChapter { chapter: string; items: string[]; }

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
    try {
      const text = await file.text();
      setPdfText(text);
    } catch {
      setPdfText(file.name);
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

          {/* 업로드 박스 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <Card
            onClick={() => fileInputRef.current?.click()}
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

          {/* 콘텐츠 유형 */}
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

    // 프로그레스 애니메이션
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 8 + 2;
      if (p >= 85) { clearInterval(iv); }
      setProgress(Math.min(p, 85));
    }, 200);

    // AI 호출
    const generate = async () => {
      setStatusMsg("AI 스토리보드 생성 중...");
      try {
        const res = await fetch("/api/ai-edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdfText: pdfText || fileName }),
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
            screen_desc: p.screen_desc || "",
            narration: p.narration || "",
          }));
          setTimeout(() => onDone(
            pages,
            data.result.index || [],
            data.result.course_title || "AI 생성 스토리보드"
          ), 500);
        } else {
          // fallback: 빈 페이지 1개
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
  };
}

// ── 슬라이드 엘리먼트 렌더러 ─────────────────────────
function SlideElementComponent({
  el, onUpdate, scale = 1
}: { el: SlideElement; onUpdate: (el: SlideElement) => void; scale?: number }) {
  const fs = (n: number) => `${Math.round(n * scale)}px`;

  if (el.type === "heading") return (
    <div className="flex items-center gap-1.5 mb-2.5">
      <Badge className="bg-red-500 text-white font-extrabold shrink-0" style={{ fontSize: fs(11), padding: `2px ${Math.round(7 * scale)}px` }}>#1</Badge>
      <Input value={el.text || ""} onChange={e => onUpdate({ ...el, text: e.target.value })}
        className="flex-1 border-0 bg-transparent font-bold text-foreground focus-visible:ring-0 focus-visible:border-b focus-visible:border-dashed focus-visible:border-primary p-0.5 h-auto"
        style={{ fontSize: fs(18) }} />
    </div>
  );

  if (el.type === "circles" || el.type === "bullets") return (
    <div className="mb-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Badge className="bg-red-500 text-white font-extrabold shrink-0" style={{ fontSize: fs(11), padding: `2px ${Math.round(7 * scale)}px` }}>#2</Badge>
        <span className="text-muted-foreground" style={{ fontSize: fs(10) }}>
          {el.type === "circles" ? "원형 다이어그램" : "불릿 리스트"}
        </span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {(el.items || []).map((item, idx) => (
          el.type === "circles" ? (
            <div key={idx} className="flex flex-col items-center gap-1">
              <div className="rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center"
                style={{ width: Math.round(70 * scale), height: Math.round(70 * scale) }}>
                <Textarea value={item} onChange={e => {
                  const ni = [...(el.items || [])]; ni[idx] = e.target.value;
                  onUpdate({ ...el, items: ni });
                }} rows={2} className="bg-transparent border-0 text-center font-semibold text-blue-800 resize-none focus-visible:ring-0 p-0 leading-tight"
                  style={{ width: Math.round(56 * scale), fontSize: fs(11) }} />
              </div>
            </div>
          ) : (
            <div key={idx} className="flex items-start gap-1.5 w-full">
              <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" style={{ marginTop: Math.round(6 * scale) }} />
              <Input value={item} onChange={e => {
                const ni = [...(el.items || [])]; ni[idx] = e.target.value;
                onUpdate({ ...el, items: ni });
              }} className="flex-1 border-0 bg-transparent text-foreground focus-visible:ring-0 focus-visible:border-b focus-visible:border-dashed focus-visible:border-primary p-0.5 h-auto"
                style={{ fontSize: fs(13) }} />
            </div>
          )
        ))}
      </div>
    </div>
  );

  if (el.type === "emphasis" || el.type === "question") return (
    <div className="flex items-start gap-1.5 mt-2.5">
      <Badge className="bg-red-500 text-white font-extrabold shrink-0" style={{ fontSize: fs(11), padding: `2px ${Math.round(7 * scale)}px` }}>#3</Badge>
      <Textarea value={el.text || ""} onChange={e => onUpdate({ ...el, text: e.target.value })}
        rows={2}
        className={cn("flex-1 border border-transparent rounded-md focus-visible:ring-0 focus-visible:border-primary w-full resize-none leading-relaxed",
          el.type === "emphasis" ? "bg-yellow-50 font-bold text-amber-800" : "bg-sky-50 font-medium text-sky-700")}
        style={{ fontSize: fs(14), padding: `${Math.round(6 * scale)}px ${Math.round(8 * scale)}px` }} />
    </div>
  );

  if (el.type === "subtitle_text") return (
    <div className="flex items-center gap-1.5 mb-2">
      <Badge className="bg-red-500 text-white font-extrabold shrink-0" style={{ fontSize: fs(11), padding: `2px ${Math.round(7 * scale)}px` }}>#2</Badge>
      <Input value={el.text || ""} onChange={e => onUpdate({ ...el, text: e.target.value })}
        className="flex-1 border-0 bg-transparent font-semibold text-muted-foreground focus-visible:ring-0 p-0.5 h-auto"
        style={{ fontSize: fs(16) }} />
    </div>
  );

  return null;
}

// ── 슬라이드 뷰 ──────────────────────────────────────
function SlideView({
  page, onUpdate, slideWidth, indexStructure
}: {
  page: Page; onUpdate: (page: Page) => void;
  slideWidth: number; indexStructure: IndexChapter[];
}) {
  const baseWidth = 1020;
  const scale = slideWidth / baseWidth;
  const fs = (n: number) => `${Math.round(n * scale)}px`;

  const updateElement = (updatedEl: SlideElement) => {
    onUpdate({ ...page, slide: { ...page.slide, elements: page.slide.elements.map(el => el.id === updatedEl.id ? updatedEl : el) } });
  };

  const indexWidth = slideWidth * 0.18;
  const slideHeight = slideWidth * 9 / 16;
  const narrationHeight = slideHeight * 0.18;
  const metaHeaderHeight = Math.round(36 * scale);

  return (
    <Card className="overflow-hidden shadow-sm w-full h-full flex flex-col" style={{ borderRadius: Math.round(10 * scale) }}>
      {/* 메타 헤더 */}
      <div className="border-b-2 border-foreground bg-card shrink-0 flex items-stretch" style={{ height: metaHeaderHeight }}>
        <div className="flex items-stretch flex-1">
          {[{ label: "과정명", value: page.course }, { label: "주차명", value: page.week }, { label: "페이지", value: page.page_id }]
            .map(({ label, value }, i) => (
              <div key={i} className="flex items-stretch">
                <div className="bg-foreground text-background font-bold whitespace-nowrap flex items-center"
                  style={{ padding: `0 ${fs(8)}`, fontSize: fs(9) }}>{label}</div>
                <div className="border-r-2 border-foreground text-muted-foreground flex items-center"
                  style={{ padding: `0 ${fs(8)}`, fontSize: fs(9), minWidth: i === 0 ? Math.round(180 * scale) : i === 1 ? Math.round(100 * scale) : Math.round(80 * scale) }}>
                  <Input value={value} readOnly className="border-0 bg-transparent text-muted-foreground w-full p-0 h-auto focus-visible:ring-0" style={{ fontSize: fs(9) }} />
                </div>
              </div>
            ))}
        </div>
        <div className="flex items-center gap-1 shrink-0" style={{ padding: `0 ${fs(8)}` }}>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <Button key={k} variant="outline" size="sm"
              onClick={() => onUpdate({ ...page, status: k as Page["status"] })}
              className={cn("rounded-full transition-all h-auto",
                page.status === k ? cn(v.bgClassName, v.className, "border-current") : "border-border text-muted-foreground")}
              style={{ fontSize: fs(9), padding: `${fs(2)} ${fs(8)}` }}>{v.label}</Button>
          ))}
        </div>
      </div>

      {/* 바디 */}
      <div className="flex flex-1 min-h-0">
        {/* INDEX */}
        <div className="border-r-2 border-foreground shrink-0 overflow-y-auto" style={{ width: indexWidth, padding: `${fs(8)} 0` }}>
          {indexStructure.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span style={{ fontSize: "10px", color: "#94a3b8" }}>목차 없음</span>
            </div>
          ) : (
            indexStructure.map((ch, ci) => (
              <div key={ci}>
                <div className="bg-foreground text-background font-bold mb-0.5"
                  style={{ fontSize: fs(10), padding: `${fs(4)} ${fs(8)}` }}>{ch.chapter}</div>
                {ch.items.map((item, ii) => {
                  const isActive = ci === page.chapter_index && ii === page.item_index;
                  return (
                    <div key={ii} className={cn("flex items-center gap-1 rounded-sm",
                      isActive ? "text-foreground font-bold border border-dashed border-red-500" : "text-muted-foreground border border-transparent")}
                      style={{ padding: `${fs(3)} ${fs(8)}`, fontSize: fs(10), margin: `1px ${fs(4)}` }}>
                      {isActive && <div className="w-1 h-1 rounded-full bg-red-500 shrink-0" />}
                      {item}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="border-b border-border shrink-0" style={{ padding: `${fs(8)} ${fs(14)}` }}>
            <Input value={page.slide.title} onChange={e => onUpdate({ ...page, slide: { ...page.slide, title: e.target.value } })}
              placeholder="슬라이드 제목"
              className="block border-0 bg-transparent font-bold text-foreground w-full focus-visible:ring-0 p-0 h-auto placeholder:text-muted-foreground/40"
              style={{ fontSize: fs(14) }} />
            <Input value={page.slide.subtitle} onChange={e => onUpdate({ ...page, slide: { ...page.slide, subtitle: e.target.value } })}
              placeholder="서브 제목"
              className="block border-0 bg-transparent text-muted-foreground w-full mt-0.5 focus-visible:ring-0 p-0 h-auto placeholder:text-muted-foreground/40"
              style={{ fontSize: fs(11) }} />
          </div>

          <div className="flex-1 relative min-h-0">
            <div className="absolute pointer-events-none"
              style={{ top: "5%", left: "5%", right: "5%", bottom: "5%", border: "1px dashed #cbd5e1", opacity: 0.4, borderRadius: Math.round(4 * scale) }} />
            {page.slide.elements.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>AI가 콘텐츠를 자동으로 생성합니다</span>
              </div>
            )}
            {page.slide.elements.length > 0 && (
              <div className="relative h-full overflow-y-auto" style={{ padding: `${Math.round(slideWidth * 0.05 * 0.82 * 0.5)}px` }}>
                {page.slide.elements.map(el => (
                  <SlideElementComponent key={el.id} el={el} onUpdate={updateElement} scale={scale} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 나레이션 */}
      <div className="border-t-2 border-foreground flex shrink-0 mt-auto" style={{ minHeight: narrationHeight * 1.22 }}>
        <div className="bg-foreground flex items-center justify-center shrink-0" style={{ width: Math.round(44 * scale) }}>
          <div className="text-background font-bold tracking-widest" style={{ fontSize: fs(10), writingMode: "vertical-rl" }}>나레이션</div>
        </div>
        <div className="flex-1 flex" style={{ padding: `${fs(6)} ${fs(10)}` }}>
          <Textarea value={page.narration} onChange={e => onUpdate({ ...page, narration: e.target.value })}
            className="w-full h-full border border-transparent rounded-md bg-transparent text-foreground resize-none leading-relaxed focus-visible:ring-0 focus-visible:border-primary"
            style={{ fontSize: fs(12), padding: `${fs(4)} ${fs(6)}`, minHeight: Math.round(narrationHeight * 0.9) }} />
        </div>
      </div>
    </Card>
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
        onApply(data.result.slide, data.result.narration || currentPage.narration);
      }

      // 히스토리에 추가
      const now = new Date();
      const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      setHistory(h => [...h, {
        id: ++historyIdRef.current,
        request: userRequest,
        summary,
        timestamp,
      }]);

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
      <div className="px-3.5 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">✦</span>
          <span className="font-bold text-[13px] text-foreground">AI 수정 요청</span>
        </div>
        <div className="flex items-center gap-1.5">
          {history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setHistory([])}
              className="text-[10px] text-muted-foreground h-5 px-1.5">
              기록 삭제
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onToggle} className="text-muted-foreground h-6 w-6">
            <ChevronLeft size={14} />
          </Button>
        </div>
      </div>

      {/* 입력창 */}
      <div className="px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex gap-1.5 items-end">
          <Textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="수정할 내용을 입력하세요..." rows={3} disabled={isProcessing}
            className="flex-1 px-2.5 py-1.5 border border-border rounded-lg text-xs resize-none focus-visible:ring-0 focus-visible:border-primary leading-relaxed disabled:opacity-50" />
          <Button onClick={handleSend} disabled={!input.trim() || isProcessing} size="icon"
            className={cn("w-8 h-8 rounded-lg shrink-0", !input.trim() || isProcessing ? "bg-muted text-muted-foreground" : "")}>
            <Send size={13} />
          </Button>
        </div>
        <div className="mt-1.5 text-[10px] text-muted-foreground">Enter: 전송 / Shift+Enter: 줄바꿈</div>
      </div>

      {/* 히스토리 + 진행상태 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">

        {/* 히스토리 없고 처리 중도 아닐 때 */}
        {history.length === 0 && !isProcessing && (
          <div className="text-center py-8">
            <div className="text-2xl mb-2 opacity-40">💡</div>
            <p className="text-xs text-muted-foreground/60 leading-relaxed">
              현재 슬라이드에 대한<br />수정 요청을 입력하세요.
            </p>
          </div>
        )}

        {/* 히스토리 목록 */}
        {history.map(item => (
          <div key={item.id} className="flex flex-col gap-1.5">
            {/* 요청 말풍선 */}
            <div className="flex justify-end">
              <div className="bg-primary text-primary-foreground rounded-xl rounded-tr-sm px-3 py-2 max-w-[85%]">
                <p className="text-[11px] leading-relaxed">{item.request}</p>
              </div>
            </div>
            {/* 결과 말풍선 */}
            <div className="flex justify-start">
              <div className="bg-muted border border-border rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%]">
                <div className="flex items-center gap-1 mb-1">
                  <CheckCircle size={10} className="text-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-600">적용 완료</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{item.timestamp}</span>
                </div>
                <p className="text-[11px] text-foreground leading-relaxed">{item.summary}</p>
              </div>
            </div>
          </div>
        ))}

        {/* 진행 중 */}
        {isProcessing && (
          <div className="bg-muted/50 border border-border rounded-lg p-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2 mb-2 last:mb-0">
                {step.status === "loading" ? <Loader size={12} className="text-primary animate-spin shrink-0" />
                  : step.status === "done" ? <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                  : <Clock size={12} className="text-muted-foreground shrink-0" />}
                <span className={cn("text-[11px]",
                  step.status === "done" ? "text-foreground" : step.status === "loading" ? "text-primary" : "text-muted-foreground")}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
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
  const [indexStructure, setIndexStructure] = useState<IndexChapter[]>(initialIndex);
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
      const hm = Math.max(16, Math.min(40, aw * 0.025)) * 2;
      const vm = Math.max(12, Math.min(32, ah * 0.015)) * 2;
      const maxH = ah - vm - PAGINATION_HEIGHT - 16;
      const wbw = aw - hm;
      const wbh = wbw * 9 / 16;
      setSlideWidth(Math.max(400, wbh <= maxH ? wbw : maxH * 16 / 9));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [aiPanelWidth, aiCollapsed]);

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
  const slideHeight = slideWidth * 9 / 16;

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
          <Button size="sm" className="text-xs font-bold gap-1">
            <Download size={12} />PDF 내보내기
          </Button>
        </div>
      </header>

      {/* 서브바 */}
      <div className="bg-card border-b border-muted flex items-center px-4 gap-3.5 text-xs text-muted-foreground shrink-0" style={{ height: SUBBAR_HEIGHT }}>
        <span>총 <strong className="text-foreground">{pages.length}페이지</strong></span>
        <span className="text-border">·</span>
        <span>검수율 <strong className="text-emerald-500">{Math.round(stats.approved / pages.length * 100)}%</strong></span>
        <span className="text-border">·</span>
        <span className="text-primary text-[11px]">💡 텍스트 클릭 시 직접 편집 가능</span>
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

        <div ref={slideAreaRef} className="flex-1 flex flex-col items-center justify-center overflow-hidden"
          style={{ padding: "clamp(12px,1.5vh,32px) clamp(16px,2.5vw,40px)" }}>
          {viewMode === "single" ? (
            <>
              <div style={{ width: slideWidth, height: slideHeight }}>
                <SlideView page={currentPage} onUpdate={updatePage} slideWidth={slideWidth} indexStructure={indexStructure} />
              </div>
              <div className="flex items-center justify-center gap-3 shrink-0" style={{ marginTop: 16, height: PAGINATION_HEIGHT }}>
                <Button variant="outline" size="sm" onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                  disabled={currentIdx === 0} className="text-xs font-semibold gap-1">
                  <ChevronLeft size={14} />이전
                </Button>
                <div className="flex gap-1">
                  {pages.map((_, i) => (
                    <Button key={i} variant={i === currentIdx ? "default" : "outline"} size="sm"
                      onClick={() => setCurrentIdx(i)}
                      className={cn("w-8 h-8 p-0 text-xs font-semibold", i === currentIdx && "bg-primary text-primary-foreground")}>
                      {i + 1}
                    </Button>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={() => setCurrentIdx(i => Math.min(pages.length - 1, i + 1))}
                  disabled={currentIdx === pages.length - 1} className="text-xs font-semibold gap-1">
                  다음<ChevronRight size={14} />
                </Button>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4 w-full h-full overflow-auto p-4">
              {pages.slice(0, 4).map((p, i) => (
                <div key={p.id} className="cursor-pointer" onClick={() => { setCurrentIdx(i); setViewMode("single"); }}>
                  <SlideView page={p} onUpdate={updatePage} slideWidth={slideWidth / 2 - 16} indexStructure={indexStructure} />
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
