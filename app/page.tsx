"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, Check, Download, ChevronLeft, ChevronRight, Send, Clock, CheckCircle, Loader, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── 타입 정의 ──────────────────────────────────────────────────
interface ContentType {
  id: string;
  label: string;
  icon: string;
  desc: string;
  active: boolean;
}

interface StatusConfig {
  label: string;
  className: string;
  bgClassName: string;
}

interface SlideElement {
  id: string;
  order: number;
  type: "heading" | "circles" | "bullets" | "emphasis" | "question" | "subtitle_text";
  text?: string;
  items?: string[];
}

interface Slide {
  title: string;
  subtitle: string;
  layout: string;
  elements: SlideElement[];
}

interface Page {
  id: number;
  page_id: string;
  course: string;
  week: string;
  chapter_index: number;
  item_index: number;
  status: "approved" | "review" | "editing";
  slide: Slide;
  screen_desc: string;
  narration: string;
}

// ── 데이터 ──────────────────────────────────────────────────
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

// INDEX 구조 - 빈 상태
const INDEX_STRUCTURE: { chapter: string; items: string[] }[] = [];

// 초기 페이지 - 빈 상태
const MOCK_PAGES: Page[] = [
  {
    id: 1, 
    page_id: "",
    course: "",
    week: "",
    chapter_index: -1, 
    item_index: -1,
    status: "editing",
    slide: {
      title: "",
      subtitle: "",
      layout: "",
      elements: [],
    },
    screen_desc: "",
    narration: "",
  },
];

// ── 업로드 화면 ──────────────────────────────────────────────
function UploadScreen({ onNext }: { onNext: () => void }) {
  const [selectedType, setSelectedType] = useState("elearning");
  const [fileName, setFileName] = useState<string | null>(null);

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
          <Card
            onClick={() => setFileName("sample_script.pdf")}
            className={cn(
              "border-2 border-dashed rounded-2xl p-10 text-center mb-7 cursor-pointer transition-all",
              fileName ? "border-primary bg-secondary/50" : "border-primary/30 bg-card hover:border-primary/50"
            )}
          >
            {fileName ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                  <Check size={18} className="text-primary" />
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
                <div className="mt-4 text-xs text-muted-foreground/60">또는 텍스트 직접 붙여넣기 가능</div>
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

          {/* 안내 문구 */}
          <Card className="bg-secondary/50 border-primary/20 rounded-lg p-2.5 mb-5 flex gap-2 items-start">
            <span className="text-sm mt-0.5">{"ℹ️"}</span>
            <p className="text-xs text-primary leading-relaxed">
              현재 <strong>이러닝 콘텐츠</strong> 유형이 우선 제공됩니다. 모션그래픽, 홍보영상, 인터뷰영상은 순차적으로 업데이트될 예정입니다.
            </p>
          </Card>

  <Button onClick={onNext} className="w-full py-4 text-[15px] font-bold rounded-xl">
    스토리보드 생성 시작 <span aria-hidden="true">&rarr;</span>
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

// ── 생성 중 화면 ─────────────────────────────────────────────
function GeneratingScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 14 + 4;
      if (p >= 100) { p = 100; clearInterval(iv); setTimeout(onDone, 400); }
      setProgress(Math.min(p, 100));
    }, 200);
    return () => clearInterval(iv);
  }, [onDone]);

  const steps = [
    { msg: "PDF 텍스트 파싱 완료", threshold: 20 },
    { msg: "페이지 단위 구조 분석 중", threshold: 45 },
    { msg: "슬라이드 레이아웃 구성 중", threshold: 65 },
    { msg: "나레이션·자막 매핑 완료", threshold: 85 },
    { msg: "스토리보드 최종 생성 완료", threshold: 98 },
  ];

  return (
    <div className="min-h-screen bg-background font-sans flex items-center justify-center">
      <div className="text-center max-w-[360px] p-10">
        <div className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">{"◈"}</div>
        <h2 className="text-lg font-extrabold text-foreground mb-1.5 tracking-tight">스토리보드 생성 중</h2>
        <p className="text-muted-foreground text-xs mb-6">이러닝 콘텐츠 프롬프트로 원고를 분석하고 있습니다.</p>
        <div className="bg-muted rounded-full h-1.5 overflow-hidden mb-1.5">
          <div className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-[11px] text-muted-foreground mb-5">{Math.round(progress)}% 완료</div>
        <div className="flex flex-col gap-1.5 text-left">
          {steps.map(({ msg, threshold }, i) => (
            <div key={i} className={cn("flex items-center gap-2 text-xs transition-colors", progress >= threshold ? "text-foreground" : "text-muted-foreground")}>
              <div className={cn("w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 transition-colors", progress >= threshold ? "bg-secondary" : "bg-muted")}>
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

// ── 슬라이드 콘텐츠 요소 렌더러 ──────────────────────────────
function SlideElementComponent({ el, onUpdate, scale = 1 }: { el: SlideElement; onUpdate: (el: SlideElement) => void; scale?: number }) {
  const fontSize = (n: number) => `${Math.round(n * scale)}px`;

  if (el.type === "heading") return (
    <div className="flex items-center gap-1.5 mb-2.5">
      <Badge className="bg-red-500 text-white font-extrabold shrink-0" style={{ fontSize: fontSize(11), padding: `2px ${Math.round(7 * scale)}px` }}>#1</Badge>
      <Input
        value={el.text || ""}
        onChange={e => onUpdate({ ...el, text: e.target.value })}
        className="flex-1 border-0 bg-transparent font-bold text-foreground focus-visible:ring-0 focus-visible:border-b focus-visible:border-dashed focus-visible:border-primary p-0.5 h-auto"
        style={{ fontSize: fontSize(18) }}
      />
    </div>
  );

  if (el.type === "circles" || el.type === "bullets") return (
    <div className="mb-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Badge className="bg-red-500 text-white font-extrabold shrink-0" style={{ fontSize: fontSize(11), padding: `2px ${Math.round(7 * scale)}px` }}>#2</Badge>
        <span className="text-muted-foreground" style={{ fontSize: fontSize(10) }}>
          {el.type === "circles" ? "원형 다이어그램 (순차 등장)" : "불릿 리스트 (순차 등장)"}
        </span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {(el.items || []).map((item, idx) => (
          el.type === "circles" ? (
            <div key={idx} className="flex flex-col items-center gap-1">
              <div
                className="rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center"
                style={{ width: Math.round(70 * scale), height: Math.round(70 * scale) }}
              >
                <Textarea
                  value={item}
                  onChange={e => {
                    const newItems = [...(el.items || [])];
                    newItems[idx] = e.target.value;
                    onUpdate({ ...el, items: newItems });
                  }}
                  rows={2}
                  className="bg-transparent border-0 text-center font-semibold text-blue-800 resize-none focus-visible:ring-0 p-0 leading-tight"
                  style={{ width: Math.round(56 * scale), fontSize: fontSize(11) }}
                />
              </div>
            </div>
          ) : (
            <div key={idx} className="flex items-start gap-1.5 w-full">
              <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" style={{ marginTop: Math.round(6 * scale) }} />
              <Input
                value={item}
                onChange={e => {
                  const newItems = [...(el.items || [])];
                  newItems[idx] = e.target.value;
                  onUpdate({ ...el, items: newItems });
                }}
                className="flex-1 border-0 bg-transparent text-foreground focus-visible:ring-0 focus-visible:border-b focus-visible:border-dashed focus-visible:border-primary p-0.5 h-auto"
                style={{ fontSize: fontSize(13) }}
              />
            </div>
          )
        ))}
      </div>
      {el.type === "circles" && (
        <div className="mt-1.5 text-muted-foreground" style={{ fontSize: fontSize(9) }}>{"↑ 원 안 텍스트 클릭 시 편집 가능"}</div>
      )}
    </div>
  );

  if (el.type === "emphasis" || el.type === "question") return (
    <div className="flex items-start gap-1.5 mt-2.5">
      <Badge className="bg-red-500 text-white font-extrabold shrink-0" style={{ fontSize: fontSize(11), padding: `2px ${Math.round(7 * scale)}px` }}>#3</Badge>
      <Textarea
        value={el.text || ""}
        onChange={e => onUpdate({ ...el, text: e.target.value })}
        rows={2}
        className={cn(
          "flex-1 border border-transparent rounded-md focus-visible:ring-0 focus-visible:border-primary w-full resize-none leading-relaxed",
          el.type === "emphasis" ? "bg-yellow-50 font-bold text-amber-800" : "bg-sky-50 font-medium text-sky-700"
        )}
        style={{ fontSize: fontSize(14), padding: `${Math.round(6 * scale)}px ${Math.round(8 * scale)}px` }}
      />
    </div>
  );

  if (el.type === "subtitle_text") return (
    <div className="flex items-center gap-1.5 mb-2">
      <Badge className="bg-red-500 text-white font-extrabold shrink-0" style={{ fontSize: fontSize(11), padding: `2px ${Math.round(7 * scale)}px` }}>#2</Badge>
      <Input
        value={el.text || ""}
        onChange={e => onUpdate({ ...el, text: e.target.value })}
        className="flex-1 border-0 bg-transparent font-semibold text-muted-foreground focus-visible:ring-0 focus-visible:border-b focus-visible:border-dashed focus-visible:border-primary p-0.5 h-auto"
        style={{ fontSize: fontSize(16) }}
      />
    </div>
  );

  return null;
}

// ── 슬라이드 뷰 (단일 페이지) - PIP 제거, 구조 단순화 ────────────────────────────────
function SlideView({ page, onUpdate, slideWidth }: { page: Page; onUpdate: (page: Page) => void; slideWidth: number }) {
  // 슬라이드 너비 기준 비율 계산
  const baseWidth = 1020; // 기준 너비
  const scale = slideWidth / baseWidth;
  
  const fontSize = (n: number) => `${Math.round(n * scale)}px`;
  const updateElement = (updatedEl: SlideElement) => {
    const newSlide = {
      ...page.slide,
      elements: page.slide.elements.map(el => el.id === updatedEl.id ? updatedEl : el)
    };
    onUpdate({ ...page, slide: newSlide });
  };

  // 비율 기반 너비 계산 (PIP 제거로 단순화)
  const indexWidth = slideWidth * 0.18; // 18%
  const slideHeight = slideWidth * 9 / 16;
  const narrationHeight = slideHeight * 0.18; // 높이의 18%
  const metaHeaderHeight = Math.round(36 * scale); // 메타 헤더 36px 기준

  return (
    <Card className="overflow-hidden shadow-sm w-full h-full flex flex-col" style={{ borderRadius: Math.round(10 * scale) }}>
      {/* 메타 헤더 - 승인/검토/수정 버튼 포함 (상단 여백 없이 붙임) */}
      <div 
        className="border-b-2 border-foreground bg-card shrink-0 flex items-stretch"
        style={{ height: metaHeaderHeight, marginTop: 0 }}
      >
        {/* 과정명/주차명/페이지 */}
        <div className="flex items-stretch flex-1">
          {[
            { label: "과정명", value: page.course },
            { label: "주차명", value: page.week },
            { label: "페이지", value: page.page_id },
          ].map(({ label, value }, i) => (
            <div key={i} className="flex items-stretch">
              <div 
                className="bg-foreground text-background font-bold whitespace-nowrap flex items-center"
                style={{ padding: `0 ${fontSize(8)}`, fontSize: fontSize(9) }}
              >
                {label}
              </div>
              <div 
                className="border-r-2 border-foreground text-muted-foreground flex items-center"
                style={{ padding: `0 ${fontSize(8)}`, fontSize: fontSize(9), minWidth: i === 0 ? Math.round(180 * scale) : i === 1 ? Math.round(100 * scale) : Math.round(80 * scale) }}
              >
                <Input 
                  value={value} 
                  readOnly 
                  className="border-0 bg-transparent text-muted-foreground w-full p-0 h-auto focus-visible:ring-0" 
                  style={{ fontSize: fontSize(9) }} 
                />
              </div>
            </div>
          ))}
        </div>
        
        {/* 승인/검토중/수정필요 버튼 - 메타 헤더 우측 */}
        <div className="flex items-center gap-1 shrink-0" style={{ padding: `0 ${fontSize(8)}` }}>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <Button
              key={k}
              variant="outline"
              size="sm"
              onClick={() => onUpdate({ ...page, status: k as Page["status"] })}
              className={cn(
                "rounded-full transition-all h-auto",
                page.status === k ? cn(v.bgClassName, v.className, "border-current") : "border-border text-muted-foreground"
              )}
              style={{ fontSize: fontSize(9), padding: `${fontSize(2)} ${fontSize(8)}` }}
            >{v.label}</Button>
          ))}
        </div>
      </div>

      {/* 바디 - INDEX + 콘텐츠 영역 (16:9 내부) */}
      <div className="flex flex-1 min-h-0">
        {/* INDEX 패널 - 18% */}
        <div className="border-r-2 border-foreground shrink-0 overflow-y-auto" style={{ width: indexWidth, padding: `${fontSize(8)} 0` }}>
          {INDEX_STRUCTURE.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>목차 없음</span>
            </div>
          ) : (
            INDEX_STRUCTURE.map((ch, ci) => (
              <div key={ci}>
                <div className="bg-foreground text-background font-bold mb-0.5" style={{ fontSize: fontSize(10), padding: `${fontSize(4)} ${fontSize(8)}` }}>{ch.chapter}</div>
                {ch.items.map((item, ii) => {
                  const isActive = ci === page.chapter_index && ii === page.item_index;
                  return (
                    <div key={ii} className={cn(
                      "flex items-center gap-1 rounded-sm",
                      isActive ? "text-foreground font-bold border border-dashed border-red-500" : "text-muted-foreground border border-transparent"
                    )} style={{ padding: `${fontSize(3)} ${fontSize(8)}`, fontSize: fontSize(10), margin: `1px ${fontSize(4)}` }}>
                      {isActive && <div className="w-1 h-1 rounded-full bg-red-500 shrink-0" />}
                      {item}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* 콘텐츠 영역 - 82% (PIP 제거로 전체 사용) */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 슬라이드 제목 */}
          <div className="border-b border-border shrink-0" style={{ padding: `${fontSize(8)} ${fontSize(14)}` }}>
            <Input
              value={page.slide.title}
              onChange={e => onUpdate({ ...page, slide: { ...page.slide, title: e.target.value } })}
              placeholder="슬라이드 제목"
              className="block border-0 bg-transparent font-bold text-foreground w-full focus-visible:ring-0 focus-visible:border-b focus-visible:border-dashed focus-visible:border-primary p-0 h-auto placeholder:text-muted-foreground/40"
              style={{ fontSize: fontSize(14) }}
            />
            <Input
              value={page.slide.subtitle}
              onChange={e => onUpdate({ ...page, slide: { ...page.slide, subtitle: e.target.value } })}
              placeholder="서브 제목"
              className="block border-0 bg-transparent text-muted-foreground w-full mt-0.5 focus-visible:ring-0 focus-visible:border-b focus-visible:border-dashed focus-visible:border-primary p-0 h-auto placeholder:text-muted-foreground/40"
              style={{ fontSize: fontSize(11) }}
            />
          </div>

          {/* 슬라이드 콘텐츠 - 세이프 마진 5% 점선 표시 */}
          <div className="flex-1 relative min-h-0">
            {/* 세이프 마진 점선 표시 (5%) - #cbd5e1, opacity 0.4, 1px dashed */}
            <div 
              className="absolute pointer-events-none"
              style={{
                top: '5%',
                left: '5%',
                right: '5%',
                bottom: '5%',
                border: '1px dashed #cbd5e1',
                opacity: 0.4,
                borderRadius: Math.round(4 * scale),
              }}
            />
            
            {/* 빈 상태일 때 중앙 안내 문구 */}
            {page.slide.elements.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  AI가 콘텐츠를 자동으로 생성합니다
                </span>
              </div>
            )}
            
            {/* 실제 콘텐츠 영역 (세이프 마진 안쪽) */}
            {page.slide.elements.length > 0 && (
              <div 
                className="relative h-full overflow-y-auto"
                style={{ 
                  padding: `${Math.round(slideWidth * 0.05 * 0.82 * 0.5)}px`,
                }}
              >
                {page.slide.elements.map(el => (
                  <SlideElementComponent key={el.id} el={el} onUpdate={updateElement} scale={scale} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 나레이션 - 높이 22% (하단 여백 없이 붙임) */}
      <div className="border-t-2 border-foreground flex shrink-0 mt-auto" style={{ minHeight: narrationHeight * 1.22 }}>
        <div className="bg-foreground flex items-center justify-center shrink-0" style={{ width: Math.round(44 * scale) }}>
          <div className="text-background font-bold tracking-widest" style={{ fontSize: fontSize(10), writingMode: "vertical-rl", textOrientation: "mixed" }}>나레이션</div>
        </div>
        <div className="flex-1 flex" style={{ padding: `${fontSize(6)} ${fontSize(10)}` }}>
          <Textarea
            value={page.narration}
            onChange={e => onUpdate({ ...page, narration: e.target.value })}
            placeholder=""
            className="w-full h-full border border-transparent rounded-md bg-transparent text-foreground resize-none leading-relaxed focus-visible:ring-0 focus-visible:border-primary"
            style={{ fontSize: fontSize(12), padding: `${fontSize(4)} ${fontSize(6)}`, minHeight: Math.round(narrationHeight * 0.9) }}
          />
        </div>
      </div>
    </Card>
  );
}

// ── AI 수정 요청 패널 (Claude API 연동) ─────────────────────────────────────────
interface AiStep {
  label: string;
  status: "pending" | "loading" | "done";
}

function AiPanel({ collapsed, onToggle, currentPage, width }: { collapsed: boolean; onToggle: () => void; currentPage: Page; width: number }) {
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [steps, setSteps] = useState<AiStep[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [steps, result]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    
    const userRequest = input.trim();
    setInput("");
    setIsProcessing(true);
    setResult(null);
    setSteps([
      { label: "요청 분석 중...", status: "loading" },
      { label: "슬라이드 구조 파악 중...", status: "pending" },
      { label: "수정 사항 적용 중...", status: "pending" },
    ]);

    // 단계별 진행 시뮬레이션
    await new Promise(r => setTimeout(r, 800));
    setSteps(s => s.map((step, i) => i === 0 ? { ...step, status: "done" } : i === 1 ? { ...step, status: "loading" } : step));
    
    await new Promise(r => setTimeout(r, 800));
    setSteps(s => s.map((step, i) => i <= 1 ? { ...step, status: "done" } : { ...step, status: "loading" }));

    // API 호출
    try {
      const response = await fetch("/api/ai-edit", {
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

      const data = await response.json();
      
      setSteps(s => s.map(step => ({ ...step, status: "done" })));
      await new Promise(r => setTimeout(r, 300));
      setResult(data.result || data.error || "수정 내용을 처리했습니다.");
    } catch {
      setSteps(s => s.map(step => ({ ...step, status: "done" })));
      setResult("AI 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    }

    // 결과 표시 후 초기화 대기
    setTimeout(() => {
      setIsProcessing(false);
      setSteps([]);
      setResult(null);
    }, 5000);
  };

  if (collapsed) return (
    <div className="w-9 bg-card border-r border-border flex flex-col items-center pt-3 shrink-0">
      <Button variant="ghost" size="icon" onClick={onToggle} className="text-primary h-7 w-7" title="AI 패널 열기">
        <ChevronRight size={16} />
      </Button>
      <div className="mt-4 text-[10px] font-bold text-muted-foreground tracking-wider" style={{ writingMode: "vertical-rl" }}>AI</div>
    </div>
  );

  return (
    <div className="bg-card border-r border-border flex flex-col shrink-0 h-full" style={{ width }}>
      {/* 패널 헤더 */}
      <div className="px-3.5 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-5.5 h-5.5 bg-secondary rounded-md flex items-center justify-center">
            <span className="text-xs">{"✦"}</span>
          </div>
          <span className="font-bold text-[13px] text-foreground">AI 수정 요청</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onToggle} className="text-muted-foreground h-6 w-6">
          <ChevronLeft size={14} />
        </Button>
      </div>

      {/* 입력창 (상단 고정) */}
      <div className="px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex gap-1.5 items-end">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="수정할 내용을 입력하세요..."
            rows={3}
            disabled={isProcessing}
            className="flex-1 px-2.5 py-1.5 border border-border rounded-lg text-xs resize-none focus-visible:ring-0 focus-visible:border-primary leading-relaxed disabled:opacity-50"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            size="icon"
            className={cn("w-8.5 h-8.5 rounded-lg shrink-0", !input.trim() || isProcessing ? "bg-muted text-muted-foreground" : "")}
          >
            <Send size={13} />
          </Button>
        </div>
        <div className="mt-1.5 text-[10px] text-muted-foreground">Enter: 전송 / Shift+Enter: 줄바꿈</div>
      </div>

      {/* 처리 상태 표시 영역 */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {steps.length > 0 && (
          <div className="bg-muted/50 border border-border rounded-lg p-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2 mb-2 last:mb-0">
                {step.status === "loading" ? (
                  <Loader size={12} className="text-primary animate-spin shrink-0" />
                ) : step.status === "done" ? (
                  <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                ) : (
                  <Clock size={12} className="text-muted-foreground shrink-0" />
                )}
                <span className={cn(
                  "text-[11px]",
                  step.status === "done" ? "text-foreground" : step.status === "loading" ? "text-primary" : "text-muted-foreground"
                )}>
                  {step.label}
                </span>
              </div>
            ))}
            
            {result && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <CheckCircle size={12} className="text-emerald-500" />
                  <span className="text-[11px] font-bold text-emerald-600">완료</span>
                </div>
                <p className="text-xs text-foreground leading-relaxed">{result}</p>
              </div>
            )}
          </div>
        )}
        
        {!isProcessing && steps.length === 0 && (
          <div className="text-center py-8">
            <div className="text-2xl mb-2 opacity-40">{"💡"}</div>
            <p className="text-xs text-muted-foreground/60 leading-relaxed">
              현재 슬라이드에 대한<br />수정 요청을 입력하세요.
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── 에디터 메인 ───────────────────────────────────────────────
// 고정 높이값 (px)
const HEADER_HEIGHT = 52;
const SUBBAR_HEIGHT = 38;
const PAGINATION_HEIGHT = 48;

function EditorScreen() {
  const [pages, setPages] = useState<Page[]>(MOCK_PAGES);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [viewMode, setViewMode] = useState<"single" | "grid4">("single");
  const [aiCollapsed, setAiCollapsed] = useState(false);
  
  // 드래그 리사이저 상태
  const [aiPanelWidth, setAiPanelWidth] = useState(280);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const slideAreaRef = useRef<HTMLDivElement>(null);
  const [slideWidth, setSlideWidth] = useState(800);

  // 슬라이드 너비 계산 (한 화면에 모두 표시)
  useEffect(() => {
    const calculateSlideSize = () => {
      if (!slideAreaRef.current) return;
      
      const areaWidth = slideAreaRef.current.clientWidth;
      const availableHeight = window.innerHeight - HEADER_HEIGHT - SUBBAR_HEIGHT;
      
      // 유동 마진 계산
      const horizontalMargin = Math.max(16, Math.min(40, areaWidth * 0.025)) * 2;
      const verticalMargin = Math.max(12, Math.min(32, availableHeight * 0.015)) * 2;
      
      // 슬라이드 + 페이지네이션 + 간격이 들어갈 수 있는 최대 높이
      const maxContentHeight = availableHeight - verticalMargin - PAGINATION_HEIGHT - 16; // 16px = 슬라이드-페이지네이션 간격
      
      // 너비 기준 계산
      const widthBasedWidth = areaWidth - horizontalMargin;
      const widthBasedHeight = widthBasedWidth * 9 / 16;
      
      // 높이 제한 확인
      let finalWidth: number;
      if (widthBasedHeight <= maxContentHeight) {
        // 너비 기준으로 계산한 높이가 허용 범위 내
        finalWidth = widthBasedWidth;
      } else {
        // 높이 제한에 걸림 → 높이 기준으로 역산
        finalWidth = maxContentHeight * 16 / 9;
      }
      
      setSlideWidth(Math.max(400, finalWidth));
    };

    calculateSlideSize();
    window.addEventListener("resize", calculateSlideSize);
    return () => window.removeEventListener("resize", calculateSlideSize);
  }, [aiPanelWidth, aiCollapsed]);

  // 드래그 핸들러
  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = e.clientX - containerRect.left;
    const maxWidth = containerRect.width * 0.4; // 최대 40%
    
    setAiPanelWidth(Math.max(240, Math.min(newWidth, maxWidth)));
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

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
        <div className="w-6.5 h-6.5 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-extrabold text-[13px]">S</div>
        <span className="font-extrabold text-sm text-foreground tracking-tight">StoryKit</span>
        <div className="w-px h-4 bg-border" />
        <span className="text-xs text-muted-foreground">{currentPage.course || "프로젝트명"}</span>
        <Badge variant="secondary" className="text-[10px] font-bold">이러닝 콘텐츠</Badge>

        <div className="ml-auto flex items-center gap-1.5">
          {[{ k: "approved", l: "승인" }, { k: "review", l: "검토" }, { k: "editing", l: "수정" }].map(({ k, l }) => (
            <Badge key={k} className={cn(STATUS_CONFIG[k].bgClassName, STATUS_CONFIG[k].className, "text-[11px] font-bold")}>
              {stats[k as keyof typeof stats]} {l}
            </Badge>
          ))}
          <div className="w-px h-4 bg-border" />
          {/* 뷰 토글 */}
          <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("single")}
              className={cn("px-2.5 py-1 text-[11px] font-semibold rounded-md h-auto", viewMode === "single" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}
            >1페이지</Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("grid4")}
              className={cn("px-2.5 py-1 text-[11px] font-semibold rounded-md h-auto", viewMode === "grid4" ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}
            >4페이지</Button>
          </div>
          <Button size="sm" className="text-xs font-bold gap-1">
            <Download size={12} />PDF 내보내기
          </Button>
        </div>
      </header>

      {/* 서브바 */}
      <div className="bg-card border-b border-muted flex items-center px-4 gap-3.5 text-xs text-muted-foreground shrink-0" style={{ height: SUBBAR_HEIGHT }}>
        <span>총 <strong className="text-foreground">{pages.length}페이지</strong></span>
        <span className="text-border">{"·"}</span>
        <span>검수율 <strong className="text-emerald-500">{Math.round(stats.approved / pages.length * 100)}%</strong></span>
        <span className="text-border">{"·"}</span>
        <span className="text-primary text-[11px]">{"💡"} 텍스트 클릭 시 직접 편집 가능</span>
        <Button variant="outline" size="sm" className="ml-auto text-[11px] font-semibold gap-1 h-7">
          <Plus size={10} />페이지 추가
        </Button>
      </div>

      {/* 바디 - AI 패널 + 슬라이드 (100vh 내 모두 표시, 스크롤 없음) */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* AI 패널 */}
        <AiPanel 
          collapsed={aiCollapsed} 
          onToggle={() => setAiCollapsed(c => !c)} 
          currentPage={currentPage} 
          width={aiPanelWidth}
        />

        {/* 드래그 리사이저 */}
        {!aiCollapsed && (
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              "w-1 cursor-ew-resize transition-colors shrink-0 hover:bg-primary",
              isDragging ? "bg-primary" : "bg-border"
            )}
            title="드래그하여 패널 너비 조절"
          />
        )}

        {/* 메인 영역 - 슬라이드 + 페이지네이션이 세로 중앙 정렬 */}
        <div 
          ref={slideAreaRef}
          className="flex-1 flex flex-col items-center justify-center overflow-hidden"
          style={{ 
            padding: "clamp(12px, 1.5vh, 32px) clamp(16px, 2.5vw, 40px)"
          }}
        >
          {viewMode === "single" ? (
            <>
              {/* 슬라이드 */}
              <div style={{ width: slideWidth, height: slideHeight }}>
                <SlideView page={currentPage} onUpdate={updatePage} slideWidth={slideWidth} />
              </div>
              
              {/* 페이지 네비게이션 - 슬라이드 바로 아래 16px 간격 */}
              <div className="flex items-center justify-center gap-3 shrink-0" style={{ marginTop: 16, height: PAGINATION_HEIGHT }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                  disabled={currentIdx === 0}
                  className="text-xs font-semibold gap-1"
                >
                  <ChevronLeft size={14} />이전
                </Button>
                <div className="flex gap-1">
                  {pages.map((_, i) => (
                    <Button
                      key={i}
                      variant={i === currentIdx ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentIdx(i)}
                      className={cn("w-8 h-8 p-0 text-xs font-semibold", i === currentIdx && "bg-primary text-primary-foreground")}
                    >{i + 1}</Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentIdx(i => Math.min(pages.length - 1, i + 1))}
                  disabled={currentIdx === pages.length - 1}
                  className="text-xs font-semibold gap-1"
                >
                  다음<ChevronRight size={14} />
                </Button>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4 w-full h-full overflow-auto p-4">
              {pages.slice(0, 4).map((p, i) => (
                <div key={p.id} className="cursor-pointer" onClick={() => { setCurrentIdx(i); setViewMode("single"); }}>
                  <SlideView page={p} onUpdate={updatePage} slideWidth={slideWidth / 2 - 16} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 메인 앱 ─────────────────────────────────────────────────
export default function StoryKitApp() {
  const [step, setStep] = useState<"upload" | "generating" | "editor">("upload");

  if (step === "upload") return <UploadScreen onNext={() => setStep("generating")} />;
  if (step === "generating") return <GeneratingScreen onDone={() => setStep("editor")} />;
  return <EditorScreen />;
}
