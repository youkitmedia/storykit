"use client";

import React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload, Check, Download, ChevronLeft, ChevronRight,
  Send, Clock, CheckCircle, Loader, Plus, FileText, Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── 타입 정의 ──────────────────────────────────────────
interface ContentType { id: string; label: string; icon: string; desc: string; active: boolean; }
interface StatusConfig { label: string; className: string; bgClassName: string; }

interface SlideElement {
  id: string; order: number;
  type: "heading"|"circles"|"bullets"|"emphasis"|"question"|"subtitle_text"|"infographic"|"tabs"|"label_list"|"speech";
  subtype?: string;
  text?: string; items?: string[];
  cue?: number; // ★ 나레이션 #큐와 1:1 매칭
  style?: string; active?: number;
}
interface Slide { title: string; subtitle: string; layout: string; elements: SlideElement[]; }
interface ImageDesc { keywords: string[]; description: string; }
interface Page {
  id: number; page_id: string; course: string; week: string;
  section_name?: string;
  chapter_index: number; item_index: number;
  status: "approved"|"review"|"editing";
  slide: Slide; screen_desc: string; narration: string;
  image_desc?: ImageDesc;
  background_image?: string; // Nano Banana 2 생성 base64
  image_prompt?: string;
}
interface IndexChapter { chapter: string; scene_no?: string; items: string[]; }

// ── 상수 ──────────────────────────────────────────────
const CONTENT_TYPES: ContentType[] = [
  { id:"elearning", label:"이러닝 콘텐츠", icon:"◈", desc:"강사PIP·슬라이드 구조", active:true },
  { id:"motion",    label:"모션그래픽",    icon:"✦", desc:"순차 업데이트 예정",     active:false },
  { id:"promotional",label:"홍보영상",     icon:"◉", desc:"순차 업데이트 예정",     active:false },
  { id:"interview", label:"인터뷰영상",    icon:"◎", desc:"순차 업데이트 예정",     active:false },
];
const STATUS_CONFIG: Record<string, StatusConfig> = {
  approved: { label:"승인",    className:"text-emerald-500", bgClassName:"bg-emerald-100" },
  review:   { label:"검토 중", className:"text-amber-500",   bgClassName:"bg-amber-100" },
  editing:  { label:"수정 필요",className:"text-red-500",    bgClassName:"bg-red-100" },
};

const HEADER_HEIGHT   = 52;
const SUBBAR_HEIGHT   = 38;
const PAGINATION_HEIGHT = 48;

// ══════════════════════════════════════════════════════
// SSE 스트리밍 수신 유틸
// ══════════════════════════════════════════════════════
async function fetchSSE(
  url: string,
  body: unknown,
  onProgress: (msg: string) => void
): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  let result: unknown = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        const raw = line.slice(5).trim();
        try {
          const payload = JSON.parse(raw);
          if      (currentEvent === "progress") onProgress(payload.message ?? "");
          else if (currentEvent === "result")   result = payload.data;
          else if (currentEvent === "error")    throw new Error(payload.message ?? "Unknown error");
        } catch (e) { if (currentEvent === "error") throw e; }
        currentEvent = "";
      }
    }
  }
  return result;
}

// ── 업로드 화면 ──────────────────────────────────────
function UploadScreen({ onNext }: { onNext: (pdfText: string, fileName: string) => void }) {
  const [selectedType, setSelectedType] = useState("elearning");
  const [fileName, setFileName]   = useState<string|null>(null);
  const [pdfText, setPdfText]     = useState<string>("");
  const [isReading, setIsReading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name); setIsReading(true); setPdfText("");
    try {
      const text  = await file.text();
      const isPdf = file.name.toLowerCase().endsWith(".pdf");
      const isTxt = file.name.toLowerCase().endsWith(".txt");
      if (isPdf && text.startsWith("%PDF")) {
        setPdfText("");
        alert("이 PDF에서 텍스트를 추출할 수 없습니다.\nTXT 파일로 내보내기 후 업로드해주세요.");
      } else if (isPdf && (text.includes("<!DOCTYPE")||text.includes("<html")||text.includes("<style"))) {
        const clean = text
          .replace(/<style[\s\S]*?<\/style>/gi,"").replace(/<script[\s\S]*?<\/script>/gi,"")
          .replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<")
          .replace(/&gt;/g,">").replace(/&nbsp;/g," ").replace(/\s{2,}/g,"\n").trim();
        setPdfText(clean);
      } else if (isTxt) { setPdfText(text); }
      else { setPdfText(text); }
    } catch { setPdfText(""); }
    finally { setIsReading(false); }
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
              원고 PDF에서 스토리보드를<br/>자동으로 생성하세요
            </h1>
            <p className="text-muted-foreground text-[13px] leading-relaxed">
              콘텐츠 유형별 최적화된 AI 프롬프트로<br/>전문가 수준의 스토리보드를 즉시 생성합니다.
            </p>
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf,.txt" className="hidden"
            onChange={e=>{ const f=e.target.files?.[0]; if(f) handleFile(f); }}/>
          <Card
            onClick={()=>fileInputRef.current?.click()}
            onDragOver={e=>{e.preventDefault();e.stopPropagation();}}
            onDragEnter={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLElement).style.borderColor="hsl(var(--primary))";}}
            onDragLeave={e=>{e.preventDefault();(e.currentTarget as HTMLElement).style.borderColor="";}}
            onDrop={e=>{
              e.preventDefault();e.stopPropagation();
              (e.currentTarget as HTMLElement).style.borderColor="";
              const f=e.dataTransfer.files?.[0]; if(f) handleFile(f);
            }}
            className={cn("border-2 border-dashed rounded-2xl p-10 text-center mb-7 cursor-pointer transition-all",
              fileName?"border-primary bg-secondary/50":"border-primary/30 bg-card hover:border-primary/50")}>
            {isReading ? (
              <div className="flex items-center justify-center gap-3">
                <Loader size={18} className="animate-spin text-primary"/>
                <span className="text-sm text-muted-foreground">파일 읽는 중...</span>
              </div>
            ) : fileName ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center"><FileText size={18} className="text-primary"/></div>
                <div className="text-left">
                  <div className="font-bold text-foreground text-sm">{fileName}</div>
                  <div className="text-xs text-muted-foreground">파일 선택 완료 · 클릭해서 변경</div>
                </div>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center mx-auto mb-4"><Upload size={20} className="text-primary"/></div>
                <div className="font-bold text-foreground text-[15px] mb-1.5">원고 PDF 업로드</div>
                <div className="text-muted-foreground text-[13px] mb-4">드래그하거나 클릭해서 파일 선택</div>
                <Button className="px-6 py-2.5 text-[13px] font-bold">파일 선택</Button>
              </>
            )}
          </Card>
          <div className="mb-7">
            <div className="text-[13px] font-bold text-foreground mb-3">콘텐츠 유형 선택</div>
            <div className="grid grid-cols-2 gap-2.5">
              {CONTENT_TYPES.map(t=>(
                <button key={t.id} onClick={()=>t.active&&setSelectedType(t.id)} disabled={!t.active}
                  className={cn("p-4 rounded-xl text-left flex items-center gap-3 transition-all relative",
                    t.active?"cursor-pointer":"cursor-not-allowed opacity-55",
                    selectedType===t.id?"border-2 border-primary bg-secondary":"border border-border bg-card hover:border-primary/30")}>
                  <span className={cn("text-xl",selectedType===t.id?"text-primary":"text-muted-foreground")}>{t.icon}</span>
                  <div className="flex-1">
                    <div className={cn("font-bold text-sm",selectedType===t.id?"text-primary":t.active?"text-foreground":"text-muted-foreground")}>{t.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                  </div>
                  {selectedType===t.id&&<Check size={16} className="text-primary"/>}
                  {!t.active&&<Badge variant="outline" className="absolute top-2 right-2.5 text-[9px] font-bold">준비 중</Badge>}
                </button>
              ))}
            </div>
          </div>
          <Card className="bg-secondary/50 border-primary/20 rounded-lg p-2.5 mb-5 flex gap-2 items-start">
            <span className="text-sm mt-0.5">ℹ️</span>
            <p className="text-xs text-primary leading-relaxed">현재 <strong>이러닝 콘텐츠</strong> 유형이 우선 제공됩니다.</p>
          </Card>
          <Button onClick={()=>fileName&&onNext(pdfText,fileName)} disabled={!fileName||isReading}
            className="w-full py-4 text-[15px] font-bold rounded-xl disabled:opacity-50">
            스토리보드 생성 시작 →
          </Button>
          <div className="mt-5 flex justify-center gap-6">
            {["유형별 AI 프롬프트","씬 자동 분할","PDF 내보내기"].map((t,i)=>(
              <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check size={10} className="text-emerald-500"/>{t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 생성 중 화면 ─────────────────────────────────────
function GeneratingScreen({ onDone, pdfText, fileName }: {
  onDone: (pages: Page[], index: IndexChapter[], courseTitle: string) => void;
  pdfText: string; fileName: string;
}) {
  const [progress, setProgress]   = useState(0);
  const [statusMsg, setStatusMsg] = useState("PDF 텍스트 파싱 중...");
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    let p = 0;
    const iv = setInterval(()=>{
      let inc = p<30 ? Math.random()*4+2 : p<60 ? Math.random()*1.5+0.5 : p<85 ? Math.random()*0.4+0.1 : Math.random()*0.1+0.02;
      p = Math.min(p+inc, 92);
      setProgress(p);
    }, 400);

    const generate = async () => {
      try {
        const data = await fetchSSE(
          "/api/ai-edit",
          { mode:"generate", pdfText: pdfText||"", fileName },
          (msg)=>setStatusMsg(msg)
        );
        clearInterval(iv);
        setProgress(98); setStatusMsg("스토리보드 검증 중...");
        await new Promise(r=>setTimeout(r,600));
        setProgress(100); setStatusMsg("스토리보드 생성 완료!");

        const result = data as any;
        if (result?.pages) {
          const sanitizePage = (p: any, i: number): Page => {
            const rawElements: any[] = p.slide?.elements || p.elements || [];
            const elements = rawElements.map((el: any, ei: number) => {
              let items = el.items || [];
              if (el.type==="bullets"&&items.length>3)     items=items.slice(0,3);
              if (el.type==="circles"&&items.length>4)     items=items.slice(0,4);
              if (el.type==="infographic"&&items.length>5) items=items.slice(0,5);
              return {
                id: el.id||`el-${ei+1}`, order: el.order??ei+1,
                type: el.type||"heading", subtype: el.subtype||undefined,
                text: el.text||el.content||"", items,
                cue: el.cue ?? undefined, // ★ cue 필드 보존
              };
            });
            let narration: string = p.narration||"";
            const markerMatches = narration.match(/#\d+/g)||[];
            if (markerMatches.length > elements.length+1) {
              let count=0;
              narration = narration.replace(/#\d+/g,(m)=>{ count++; return count<=elements.length?m:""; })
                .replace(/\s{2,}/g," ").trim();
            }
            return {
              id: i+1, page_id: p.page_id||`${i+1}`,
              course: p.course||"", week: p.week||"",
              chapter_index: p.chapter_index??i, item_index: p.item_index??0,
              status: (p.status as Page["status"])||"review",
              slide: {
                title: p.slide?.title||p.title||"",
                subtitle: p.slide?.subtitle||p.subtitle||"",
                layout: p.slide?.layout||p.layout||"concept",
                elements,
              },
              section_name: p.section_name||"",
              screen_desc: p.screen_desc||"",
              narration,
              background_image: p.background_image||undefined,
              image_prompt: p.image_prompt||undefined,
            };
          };
          const pages: Page[] = result.pages.map(sanitizePage);
          setTimeout(()=>onDone(pages, result.index||[], result.course_title||"AI 생성 스토리보드"), 500);
        } else {
          setTimeout(()=>onDone([createEmptyPage(1)],[],fileName),500);
        }
      } catch {
        clearInterval(iv);
        setProgress(100); setStatusMsg("생성 완료 (기본 템플릿)");
        setTimeout(()=>onDone([createEmptyPage(1)],[],fileName),500);
      }
    };
    generate();
  }, []);

  const steps = [
    { msg:"원고 텍스트 파싱 완료", threshold:10 },
    { msg:"섹션 구조 파악 중",     threshold:30 },
    { msg:"AI 스토리보드 설계 중", threshold:55 },
    { msg:"나레이션·자막 생성 중", threshold:75 },
    { msg:"스토리보드 최종 완성",  threshold:98 },
  ];

  return (
    <div className="min-h-screen bg-background font-sans flex items-center justify-center">
      <div className="text-center max-w-[360px] p-10">
        <div className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">◈</div>
        <h2 className="text-lg font-extrabold text-foreground mb-1.5 tracking-tight">스토리보드 생성 중</h2>
        <p className="text-muted-foreground text-xs mb-6">{statusMsg}</p>
        <div className="bg-muted rounded-full h-1.5 overflow-hidden mb-1.5">
          <div className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-200" style={{width:`${progress}%`}}/>
        </div>
        <div className="text-[11px] text-muted-foreground mb-5">{Math.round(progress)}% 완료</div>
        <div className="flex flex-col gap-1.5 text-left">
          {steps.map(({msg,threshold},i)=>(
            <div key={i} className={cn("flex items-center gap-2 text-xs transition-colors",progress>=threshold?"text-foreground":"text-muted-foreground")}>
              <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors",progress>=threshold?"bg-secondary":"bg-muted")}>
                {progress>=threshold?<Check size={9} className="text-primary"/>:<div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"/>}
              </div>
              {msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function createEmptyPage(id: number): Page {
  return {
    id, page_id:"", course:"", week:"",
    chapter_index:-1, item_index:-1, status:"editing",
    slide:{ title:"", subtitle:"", layout:"", elements:[] },
    screen_desc:"", narration:"", image_desc:undefined,
  };
}

function InstructorSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 320" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <circle cx="80" cy="52" r="38"/>
      <rect x="18" y="110" width="124" height="200" rx="30" ry="30"/>
    </svg>
  );
}

function NarrationText({ text }: { text: string }) {
  if (!text) return <span className="text-slate-400 italic">나레이션이 없습니다.</span>;
  const parts = text.split(/(#\d+)/g);
  return (
    <span>
      {parts.map((part,i)=>
        /^#\d+$/.test(part)
          ? <span key={i} className="inline-flex items-center justify-center bg-red-500 text-white font-black rounded mx-1"
              style={{fontSize:"13px",padding:"1px 6px",verticalAlign:"middle",lineHeight:"18px",flexShrink:0}}>{part}</span>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

const UI_XS  = "11px";
const UI_SM  = "12px";
const UI_MD  = "14px";
const UI_NAR = "16px";

// ══════════════════════════════════════════════════════
// ★ 슬라이드 히어로 렌더러 — cue 번호 기반 마커 표시
// ══════════════════════════════════════════════════════
function SlideHeroContent({ page, scale }: { page: Page; scale: number }) {
  const elements = page.slide.elements || [];
  const hasBulletsOrCircles = elements.some(el=>el.type==="bullets"||el.type==="circles");
  const instructorRight = hasBulletsOrCircles;
  const chapterLabel = page.slide.subtitle || "";

  const sf = (base: number, min: number) => `${Math.round(Math.max(min, base*scale))}px`;
  const fs = (n: number) => `${Math.round(n*scale)}px`;

  // ★ cue 번호를 마커로 직접 사용 (element.cue 우선, fallback으로 순번)
  const getMarkerNum = (el: SlideElement, fallbackIdx: number): number =>
    el.cue ?? (fallbackIdx + 1);

  const colors = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4"];

  return (
    <div className="relative w-full h-full overflow-hidden select-none"
      style={{ fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif" }}>

      {/* 배경 이미지 (Nano Banana 2 생성 시) 또는 그라데이션 */}
      {page.background_image ? (
        <img
          src={`data:image/png;base64,${page.background_image}`}
          alt="slide background"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/20 pointer-events-none"/>
      )}

      {/* 챕터명 좌상단 */}
      {chapterLabel && (
        <div className="absolute top-0 left-0 z-20 flex items-center gap-1.5 px-3 py-2">
          <div className="w-1 h-3.5 bg-red-500 rounded-full shrink-0"/>
          <span className="font-bold text-slate-500" style={{fontSize:sf(16,12)}}>{chapterLabel}</span>
        </div>
      )}

      {/* 강사 실루엣 */}
      <div className={cn("absolute bottom-0 z-10",
        page.background_image ? "text-white/20" : "text-slate-200",
        instructorRight?"right-0 w-[36%] h-[94%]":"left-1/2 -translate-x-1/2 w-[30%] h-[90%]")}>
        <InstructorSilhouette className="w-full h-full"/>
      </div>

      {/* ── 강사 중앙: 자막 하단 배치 ── */}
      {!instructorRight && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end"
          style={{paddingBottom:fs(20),paddingLeft:fs(24),paddingRight:fs(24)}}>
          {elements.map((el,i)=>{
            const m = getMarkerNum(el, i);
            if (el.type==="heading") return (
              <div key={i} className="flex items-start gap-2 mb-1.5 justify-center">
                {el.cue!=null && <span className="shrink-0 bg-red-500 text-white font-black rounded flex items-center justify-center"
                  style={{fontSize:sf(16,10),padding:`${fs(2)} ${fs(5)}`,minWidth:fs(22),height:fs(20)}}>#{m}</span>}
                <h2 className="font-black text-slate-800 leading-tight text-center" style={{fontSize:sf(56,28)}}>{el.text}</h2>
              </div>
            );
            if (el.type==="emphasis") return (
              <div key={i} className="flex items-center gap-2 justify-center mb-1">
                <span className="shrink-0 bg-red-500 text-white font-black rounded flex items-center justify-center"
                  style={{fontSize:sf(16,10),padding:`${fs(2)} ${fs(5)}`,minWidth:fs(22),height:fs(20)}}>#{m}</span>
                <div className="px-5 py-2 bg-amber-400 rounded-xl">
                  <p className="font-black text-amber-900 text-center" style={{fontSize:sf(32,18)}}>{el.text}</p>
                </div>
              </div>
            );
            if (el.type==="question") return (
              <div key={i} className="flex items-center gap-2 justify-center mb-1">
                <span className="shrink-0 bg-red-500 text-white font-black rounded flex items-center justify-center"
                  style={{fontSize:sf(16,10),padding:`${fs(2)} ${fs(5)}`,minWidth:fs(22),height:fs(20)}}>#{m}</span>
                <div className="px-5 py-2 bg-sky-500 rounded-xl">
                  <p className="font-black text-white text-center" style={{fontSize:sf(32,18)}}>{el.text}</p>
                </div>
              </div>
            );
            if (el.type==="subtitle_text") return (
              <p key={i} className="text-center text-slate-500 font-medium mb-1" style={{fontSize:sf(20,13)}}>{el.text}</p>
            );
            return null;
          })}
        </div>
      )}

      {/* ── 강사 우측: 좌측에 콘텐츠 배치 ── */}
      {instructorRight && (
        <div className="absolute inset-0 z-20 flex flex-col justify-center"
          style={{paddingTop:fs(28),paddingLeft:fs(20),paddingRight:`calc(38% + ${fs(12)})`,paddingBottom:fs(12)}}>

          {page.slide.title && (
            <div style={{marginBottom:"12px"}}>
              <h2 className="font-black leading-tight"
                style={{fontSize:sf(40,22),color:page.background_image?"#fff":"#1e293b"}}>{page.slide.title}</h2>
              <div className="bg-red-500 rounded-full" style={{width:fs(36),height:fs(3),marginTop:fs(5)}}/>
            </div>
          )}

          {elements.map((el,i)=>{
            if (el.type==="heading") return null;
            const m = getMarkerNum(el, i);

            if (el.type==="bullets") return (
              <div key={i} className="flex flex-col" style={{gap:fs(5)}}>
                {(el.items||[]).map((item,idx)=>(
                  <div key={idx} className="flex items-center gap-2 rounded-xl border"
                    style={{
                      padding:`${fs(6)} ${fs(10)}`,
                      background: page.background_image?"rgba(255,255,255,0.85)":"#f8fafc",
                      borderColor: page.background_image?"rgba(255,255,255,0.3)":"#f1f5f9",
                    }}>
                    {/* ★ cue 번호를 첫 번째 항목에 표시 */}
                    {idx===0
                      ? <span className="shrink-0 bg-red-500 text-white font-black rounded flex items-center justify-center"
                          style={{fontSize:sf(14,10),padding:`${fs(2)} ${fs(4)}`,minWidth:fs(20),height:fs(18)}}>#{m}</span>
                      : <span className="shrink-0 bg-slate-200 text-slate-600 font-black rounded-full flex items-center justify-center"
                          style={{fontSize:sf(14,10),minWidth:fs(20),height:fs(18)}}>{idx+1}</span>
                    }
                    <p className="font-semibold text-slate-700 leading-snug" style={{fontSize:sf(26,16)}}>{item}</p>
                  </div>
                ))}
              </div>
            );

            if (el.type==="circles") return (
              <div key={i} className="flex flex-row" style={{gap:fs(8)}}>
                {(el.items||[]).map((item,idx)=>(
                  <div key={idx} className="flex-1 flex flex-col items-center" style={{gap:fs(4)}}>
                    <div className="relative rounded-full border-2 border-blue-200 bg-blue-50 flex items-center justify-center"
                      style={{width:fs(70),height:fs(70)}}>
                      <p className="font-black text-blue-700 text-center leading-tight" style={{fontSize:sf(22,13)}}>{item}</p>
                      {idx===0&&(
                        <span className="absolute -top-1.5 -left-1.5 bg-red-500 text-white font-black rounded flex items-center justify-center"
                          style={{fontSize:sf(13,9),padding:`${fs(1)} ${fs(3)}`,minWidth:fs(16),height:fs(14)}}>#{m}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );

            if (el.type==="emphasis") return (
              <div key={i} className="flex items-start gap-2 rounded-r-xl"
                style={{marginTop:fs(6),padding:`${fs(6)} ${fs(10)}`,borderLeft:`${fs(4)} solid #f59e0b`,background:"rgba(251,191,36,0.12)"}}>
                <span className="shrink-0 bg-red-500 text-white font-black rounded flex items-center justify-center mt-0.5"
                  style={{fontSize:sf(14,10),padding:`${fs(2)} ${fs(4)}`,minWidth:fs(20),height:fs(18)}}>#{m}</span>
                <p className="font-bold text-amber-800 leading-relaxed" style={{fontSize:sf(24,14)}}>{el.text}</p>
              </div>
            );

            if (el.type==="question") return (
              <div key={i} className="flex items-start gap-2 rounded-r-xl"
                style={{marginTop:fs(6),padding:`${fs(6)} ${fs(10)}`,borderLeft:`${fs(4)} solid #38bdf8`,background:"rgba(56,189,248,0.10)"}}>
                <span className="shrink-0 bg-red-500 text-white font-black rounded flex items-center justify-center mt-0.5"
                  style={{fontSize:sf(14,10),padding:`${fs(2)} ${fs(4)}`,minWidth:fs(20),height:fs(18)}}>#{m}</span>
                <p className="font-bold text-sky-800 leading-relaxed" style={{fontSize:sf(24,14)}}>{el.text}</p>
              </div>
            );

            if (el.type==="subtitle_text") return (
              <p key={i} className="font-medium leading-relaxed"
                style={{fontSize:sf(18,13),marginTop:fs(4),color:page.background_image?"#fff":"#64748b"}}>{el.text}</p>
            );

            if (el.type==="infographic") {
              const subtype = el.subtype||"icons";
              const items   = el.items||[];
              if (subtype==="icons"||subtype==="icon_grid") return (
                <div key={i} style={{marginTop:fs(8)}}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="bg-red-500 text-white font-black rounded" style={{fontSize:sf(14,10),padding:`${fs(2)} ${fs(4)}`}}>#{m}</span>
                    {el.text&&<span className="font-bold text-slate-600" style={{fontSize:sf(20,13)}}>{el.text}</span>}
                  </div>
                  <div className="flex flex-row" style={{gap:fs(8)}}>
                    {items.map((item,idx)=>(
                      <div key={idx} className="flex-1 flex flex-col items-center rounded-xl"
                        style={{padding:`${fs(8)} ${fs(6)}`,background:colors[idx%colors.length]+"18",border:`1.5px solid ${colors[idx%colors.length]}30`}}>
                        <svg width={fs(32)} height={fs(32)} viewBox="0 0 32 32" fill="none">
                          <circle cx="16" cy="16" r="14" fill={colors[idx%colors.length]} opacity="0.15"/>
                          <circle cx="16" cy="16" r="8"  fill={colors[idx%colors.length]} opacity="0.7"/>
                          <text x="16" y="20" textAnchor="middle" fontSize="11" fontWeight="bold" fill={colors[idx%colors.length]}>{idx+1}</text>
                        </svg>
                        <p className="font-bold text-center leading-snug mt-1" style={{fontSize:sf(18,12),color:colors[idx%colors.length]}}>{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
              return (
                <div key={i} className="flex flex-col" style={{gap:fs(5),marginTop:fs(6)}}>
                  <div className="flex items-center gap-1.5">
                    <span className="bg-red-500 text-white font-black rounded" style={{fontSize:sf(14,10),padding:`${fs(2)} ${fs(4)}`}}>#{m}</span>
                    {el.text&&<span className="font-bold text-slate-700" style={{fontSize:sf(22,14)}}>{el.text}</span>}
                  </div>
                  {items.map((item,idx)=>(
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-100" style={{padding:`${fs(5)} ${fs(9)}`}}>
                      <span className="shrink-0 rounded-full flex items-center justify-center font-bold text-white"
                        style={{background:colors[idx%colors.length],fontSize:sf(13,10),minWidth:fs(18),height:fs(18)}}>{idx+1}</span>
                      <p className="font-semibold text-slate-700" style={{fontSize:sf(22,14)}}>{item}</p>
                    </div>
                  ))}
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

      {page.screen_desc && (
        <div className="absolute bottom-2 right-3 z-30">
          <span className="font-bold text-slate-400 bg-white/80 rounded" style={{fontSize:UI_SM,padding:"3px 8px"}}>{page.screen_desc}</span>
        </div>
      )}
    </div>
  );
}

// ── 슬라이드 뷰 ──────────────────────────────────────
function SlideView({
  page, onUpdate, slideWidth, indexStructure, onGenerateImage
}: {
  page: Page; onUpdate:(page:Page)=>void;
  slideWidth: number; indexStructure: IndexChapter[];
  onGenerateImage?: (page: Page) => void; // ★ 이미지 생성 콜백
}) {
  const REF_TOTAL=1480, REF_PREVIEW=1080, REF_IDX=200, REF_DESC=200;
  const REF_PREV_H=600, REF_HDR_H=50, REF_NAR_H=176;
  const scaleFactor = slideWidth/REF_TOTAL;
  const indexWidth   = Math.round(Math.min(260,Math.max(120,REF_IDX*scaleFactor)));
  const descWidth    = Math.round(Math.min(260,Math.max(120,REF_DESC*scaleFactor)));
  const previewWidth = slideWidth-indexWidth-descWidth;
  const scale        = previewWidth/960;
  const layoutScale  = previewWidth/REF_PREVIEW;
  const fs = (n:number) => `${Math.round(n*scale)}px`;
  const previewH = Math.round(REF_PREV_H*layoutScale);
  const hdrH     = Math.round(Math.max(32,REF_HDR_H*layoutScale));
  const narH     = Math.round(Math.max(80,REF_NAR_H*layoutScale));

  const updateKeyword=(idx:number,val:string)=>{
    const kws=[...(page.image_desc?.keywords||["","",""])];
    kws[idx]=val;
    onUpdate({...page,image_desc:{keywords:kws,description:page.image_desc?.description||""}});
  };
  const updateDescription=(val:string)=>{
    onUpdate({...page,image_desc:{keywords:page.image_desc?.keywords||["","",""],description:val}});
  };
  const hasImageDesc=!!(page.image_desc?.keywords?.some(k=>k.trim())||page.image_desc?.description?.trim());

  return (
    <div className="border border-slate-300 bg-white flex flex-col overflow-hidden rounded-lg shadow-sm" style={{width:slideWidth}}>
      {/* 메타 헤더 */}
      <div className="flex items-stretch border-b shrink-0 bg-white" style={{height:hdrH,minHeight:32,borderBottomColor:"#E8E8E8"}}>
        <div className="flex items-stretch border-r" style={{width:"40%",borderRightColor:"#E8E8E8"}}>
          <div className="font-semibold whitespace-nowrap flex items-center shrink-0" style={{fontSize:UI_SM,padding:"0 10px",background:"#F3F3F3",color:"#1D293D"}}>과정명</div>
          <div className="flex items-center overflow-hidden px-3 font-medium" style={{fontSize:UI_MD,color:"#1D293D"}}><span className="truncate">{page.course||"—"}</span></div>
        </div>
        <div className="flex items-stretch border-r" style={{width:"32%",borderRightColor:"#E8E8E8"}}>
          <div className="font-semibold whitespace-nowrap flex items-center shrink-0" style={{fontSize:UI_SM,padding:"0 10px",background:"#F3F3F3",color:"#1D293D"}}>섹션</div>
          <div className="flex items-center overflow-hidden px-3 font-medium" style={{fontSize:UI_MD,color:"#1D293D"}}><span className="truncate">{page.section_name||page.week||"—"}</span></div>
        </div>
        <div className="flex items-stretch border-r" style={{width:"14%",borderRightColor:"#E8E8E8"}}>
          <div className="font-semibold whitespace-nowrap flex items-center shrink-0" style={{fontSize:UI_SM,padding:"0 10px",background:"#F3F3F3",color:"#1D293D"}}>페이지</div>
          <div className="flex items-center overflow-hidden px-3 font-bold" style={{fontSize:UI_MD,color:"#1D293D"}}><span>{page.page_id||"—"}</span></div>
        </div>
        <div className="flex items-center gap-1.5 flex-1 px-3">
          {Object.entries(STATUS_CONFIG).map(([k,v])=>(
            <button key={k} onClick={()=>onUpdate({...page,status:k as Page["status"]})}
              className={cn("rounded-full font-semibold border transition-all whitespace-nowrap",
                page.status===k?cn(v.bgClassName,v.className,"border-current"):"border-slate-200 text-slate-400 hover:border-slate-300")}
              style={{fontSize:UI_XS,padding:"3px 10px"}}>{v.label}</button>
          ))}
        </div>
      </div>

      {/* 바디 */}
      <div className="flex shrink-0" style={{height:previewH}}>
        {/* INDEX */}
        <div className="border-r border-slate-200 shrink-0 overflow-y-auto bg-white" style={{width:indexWidth}}>
          {indexStructure.length===0 ? (
            <div className="h-full flex items-center justify-center"><span className="text-slate-300" style={{fontSize:UI_SM}}>목차 없음</span></div>
          ) : indexStructure.map((ch,ci)=>{
            const isActive=ci===page.chapter_index;
            return (
              <div key={ci} className={cn("flex items-center justify-between transition-colors border-l-2 border-b border-slate-100",
                isActive?"bg-red-50 border-l-red-400":"border-l-transparent hover:bg-slate-50")}
                style={{padding:"6px 8px"}}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={cn("shrink-0 font-bold",isActive?"text-red-400":"text-slate-300")} style={{fontSize:"9px"}}>{ci+1}</span>
                  <span className={cn("truncate",isActive?"text-slate-800 font-semibold":"text-slate-500 font-normal")} style={{fontSize:UI_SM}}>{ch.chapter}</span>
                </div>
                {isActive&&<span className="shrink-0 text-red-400 font-bold ml-1" style={{fontSize:"9px"}}>{page.item_index+1}/{ch.items.length}</span>}
              </div>
            );
          })}
        </div>

        {/* 미리보기 */}
        <div className="shrink-0 overflow-hidden relative" style={{width:previewWidth,height:previewH}}>
          <SlideHeroContent page={page} scale={scale}/>
          {/* ★ 이미지 생성 버튼 오버레이 */}
          {onGenerateImage&&(
            <button
              onClick={()=>onGenerateImage(page)}
              className="absolute bottom-2 left-2 z-40 flex items-center gap-1 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-all"
              style={{fontSize:"10px",padding:"4px 8px"}}>
              <ImageIcon size={10}/>
              {page.background_image?"이미지 재생성":"AI 이미지 생성"}
            </button>
          )}
        </div>

        {/* 화면설명 패널 */}
        <div className="border-l border-slate-200 shrink-0 flex flex-col overflow-hidden bg-slate-50/30" style={{width:descWidth}}>
          <div className="flex flex-col h-full overflow-y-auto" style={{padding:"10px 10px"}}>
            <div className="flex items-center gap-1.5 shrink-0 mb-2">
              <div className="w-1 h-3 bg-slate-400 rounded-full shrink-0"/>
              <span className="font-semibold text-slate-500" style={{fontSize:UI_SM}}>이미지</span>
            </div>
            <div className="w-full border-t border-slate-100 shrink-0 mb-2"/>
            <div className="shrink-0 mb-3">
              <div className="text-slate-400 font-medium mb-1.5" style={{fontSize:"11px"}}>추천 검색 키워드</div>
              {(page.image_desc?.keywords||["","",""]).map((kw,ki)=>(
                <div key={ki} className="flex items-center mb-1">
                  <span className="text-slate-300 shrink-0 font-mono text-xs mr-0.5">[</span>
                  <input value={kw} onChange={e=>updateKeyword(ki,e.target.value)} placeholder={`키워드 ${ki+1}`}
                    className="flex-1 bg-white border border-slate-200 rounded text-slate-700 outline-none focus:border-blue-400 min-w-0"
                    style={{fontSize:UI_SM,padding:"3px 6px"}}/>
                  <span className="text-slate-300 shrink-0 font-mono text-xs ml-0.5">]</span>
                </div>
              ))}
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <div className="text-slate-400 font-medium mb-1.5 shrink-0" style={{fontSize:"11px"}}>이미지 설명</div>
              <textarea value={page.image_desc?.description||""} onChange={e=>updateDescription(e.target.value)}
                placeholder="이미지 내용을 설명합니다"
                className="flex-1 w-full bg-white border border-slate-200 rounded text-slate-600 resize-none outline-none focus:border-blue-400 leading-relaxed"
                style={{fontSize:UI_SM,padding:"6px 8px",minHeight:"60px"}}/>
            </div>
            {hasImageDesc&&(
              <button onClick={()=>onUpdate({...page,image_desc:undefined})}
                className="mt-2 shrink-0 w-full rounded border border-red-100 text-red-300 hover:text-red-400 hover:border-red-200 transition-all font-medium"
                style={{fontSize:"11px",padding:"4px 0"}}>내용 삭제</button>
            )}
          </div>
        </div>
      </div>

      {/* 나레이션 */}
      <div className="flex border-t border-slate-200 shrink-0 bg-white" style={{height:narH}}>
        <div className="bg-slate-800 flex items-center justify-center shrink-0" style={{width:Math.round(32*scale),height:narH}}>
          <span className="text-white font-bold tracking-widest select-none" style={{fontSize:UI_SM,writingMode:"vertical-rl",letterSpacing:"0.15em"}}>나레이션</span>
        </div>
        <div className="flex-1 leading-relaxed text-slate-600 overflow-y-auto" style={{fontSize:UI_NAR,padding:"14px 20px",lineHeight:1.7}}>
          <NarrationText text={page.narration}/>
        </div>
      </div>
    </div>
  );
}

// ── AI 패널 ───────────────────────────────────────────
interface AiStep { label:string; status:"pending"|"loading"|"done"; }
interface AiHistoryItem { id:number; request:string; summary:string; timestamp:string; }

function AiPanel({ collapsed,onToggle,currentPage,width,onApply }: {
  collapsed:boolean; onToggle:()=>void;
  currentPage:Page; width:number;
  onApply:(slide:Slide,narration:string)=>void;
}) {
  const [input,setInput]             = useState("");
  const [isProcessing,setIsProcessing] = useState(false);
  const [steps,setSteps]             = useState<AiStep[]>([]);
  const [history,setHistory]         = useState<AiHistoryItem[]>([]);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const historyIdRef = useRef(0);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[steps,history]);

  const handleSend = async () => {
    if (!input.trim()||isProcessing) return;
    const userRequest = input.trim();
    setInput(""); setIsProcessing(true);
    setSteps([
      {label:"요청 분석 중...",status:"loading"},
      {label:"슬라이드 구조 파악 중...",status:"pending"},
      {label:"수정 사항 적용 중...",status:"pending"},
    ]);
    await new Promise(r=>setTimeout(r,600));
    setSteps(s=>s.map((st,i)=>i===0?{...st,status:"done"}:i===1?{...st,status:"loading"}:st));
    await new Promise(r=>setTimeout(r,600));
    setSteps(s=>s.map((st,i)=>i<=1?{...st,status:"done"}:{...st,status:"loading"}));

    try {
      const data = await fetchSSE("/api/ai-edit",{
        mode:"edit", message:userRequest,
        slideContext:{
          title:currentPage.slide.title, subtitle:currentPage.slide.subtitle,
          narration:currentPage.narration, screen_desc:currentPage.screen_desc,
          elements:currentPage.slide.elements,
        },
      },(msg)=>setSteps(s=>s.map(st=>st.status==="loading"?{...st,label:msg}:st))) as any;

      setSteps(s=>s.map(st=>({...st,status:"done"})));
      await new Promise(r=>setTimeout(r,300));
      const summary = data?.summary||"수정이 적용되었습니다.";
      if (data?.slide) {
        const rawSlide = data.slide;
        const normalizedSlide: Slide = {
          title: rawSlide.title||currentPage.slide.title,
          subtitle: rawSlide.subtitle||currentPage.slide.subtitle,
          layout: rawSlide.layout||currentPage.slide.layout,
          elements: (rawSlide.elements||[]).map((el:any,ei:number)=>({
            id: el.id||`el-${ei+1}`, order: el.order??ei+1,
            type: el.type||"heading", text: el.text||el.content||"",
            items: el.items||[], cue: el.cue??undefined, // ★ cue 보존
          })),
        };
        onApply(normalizedSlide, data.narration||currentPage.narration);
      } else if (data?.narration) {
        onApply(currentPage.slide, data.narration);
      }
      const now=new Date();
      const timestamp=`${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
      setHistory(h=>[...h,{id:++historyIdRef.current,request:userRequest,summary,timestamp}]);
    } catch {
      setHistory(h=>[...h,{
        id:++historyIdRef.current, request:userRequest,
        summary:"오류가 발생했습니다. 다시 시도해주세요.",
        timestamp:new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}),
      }]);
    }
    setSteps([]); setIsProcessing(false);
  };

  if (collapsed) return (
    <div className="w-9 bg-card border-r border-border flex flex-col items-center pt-3 shrink-0">
      <Button variant="ghost" size="icon" onClick={onToggle} className="text-primary h-7 w-7"><ChevronRight size={16}/></Button>
      <div className="mt-4 text-[10px] font-bold text-muted-foreground tracking-wider" style={{writingMode:"vertical-rl"}}>AI</div>
    </div>
  );

  return (
    <div className="bg-card border-r border-border flex flex-col shrink-0 h-full" style={{width}}>
      <div className="px-3.5 py-2.5 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-primary">✦</span>
          <span className="font-bold text-[13px] text-foreground">AI 수정 요청</span>
        </div>
        <div className="flex items-center gap-1">
          {history.length>0&&<button onClick={()=>setHistory([])} className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors">기록 삭제</button>}
          <button onClick={onToggle} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={14}/></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5 min-h-0">
        {history.length===0&&!isProcessing&&(
          <div className="flex flex-col items-center justify-center h-full gap-2 pb-6">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg opacity-50">💡</div>
            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">현재 슬라이드에 대한<br/>수정 요청을 입력하세요.</p>
          </div>
        )}
        {history.map(item=>(
          <div key={item.id} className="flex flex-col gap-1.5">
            <div className="flex justify-end">
              <div className="bg-slate-800 text-white rounded-2xl rounded-tr-sm px-3 py-2 max-w-[86%] shadow-sm">
                <p className="text-[11px] leading-relaxed">{item.request}</p>
              </div>
            </div>
            <div className="flex justify-start items-start gap-1.5">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[8px] font-black text-primary">AI</span>
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2 max-w-[82%] shadow-sm">
                <div className="flex items-center gap-1 mb-1">
                  <CheckCircle size={9} className="text-emerald-500 shrink-0"/>
                  <span className="text-[10px] font-semibold text-emerald-600">적용 완료</span>
                  <span className="text-[9px] text-muted-foreground ml-1">{item.timestamp}</span>
                </div>
                <p className="text-[11px] text-foreground leading-relaxed">{item.summary}</p>
              </div>
            </div>
          </div>
        ))}
        {isProcessing&&(
          <div className="flex justify-start items-start gap-1.5">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[8px] font-black text-primary">AI</span>
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2.5 shadow-sm">
              {steps.map((step,i)=>(
                <div key={i} className="flex items-center gap-2 mb-1.5 last:mb-0">
                  {step.status==="loading"?<Loader size={11} className="text-primary animate-spin shrink-0"/>
                    :step.status==="done"?<CheckCircle size={11} className="text-emerald-500 shrink-0"/>
                    :<Clock size={11} className="text-muted-foreground/50 shrink-0"/>}
                  <span className={cn("text-[11px]",
                    step.status==="done"?"text-muted-foreground line-through":step.status==="loading"?"text-primary font-medium":"text-muted-foreground/50")}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      <div className="shrink-0 border-t border-border bg-card" style={{padding:"12px 12px 18px"}}>
        <div className="flex gap-2 items-end">
          <Textarea value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend();} }}
            placeholder="수정할 내용을 입력하세요..." rows={2} disabled={isProcessing}
            className="flex-1 px-2.5 py-2 border border-border rounded-xl text-xs resize-none focus-visible:ring-0 focus-visible:border-slate-400 leading-relaxed disabled:opacity-50 bg-background"/>
          <button onClick={handleSend} disabled={!input.trim()||isProcessing}
            className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all",
              input.trim()&&!isProcessing?"bg-slate-800 text-white hover:bg-slate-700 shadow-sm":"bg-muted text-muted-foreground cursor-not-allowed")}>
            <Send size={13}/>
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">Enter: 전송 &nbsp;·&nbsp; Shift+Enter: 줄바꿈</p>
      </div>
    </div>
  );
}

// ── 에디터 메인 ──────────────────────────────────────
function EditorScreen({ initialPages,initialIndex,courseTitle }: {
  initialPages:Page[]; initialIndex:IndexChapter[]; courseTitle:string;
}) {
  const [pages,setPages]             = useState<Page[]>(initialPages);
  const [indexStructure]             = useState<IndexChapter[]>(initialIndex);
  const [currentIdx,setCurrentIdx]   = useState(0);
  const [viewMode,setViewMode]       = useState<"single"|"grid4">("single");
  const [aiCollapsed,setAiCollapsed] = useState(false);
  const [aiPanelWidth,setAiPanelWidth] = useState(280);
  const [isDragging,setIsDragging]   = useState(false);
  const [generatingImageId,setGeneratingImageId] = useState<number|null>(null); // ★
  const [isExportingPptx,setIsExportingPptx]   = useState(false);
  const containerRef  = useRef<HTMLDivElement>(null);
  const slideAreaRef  = useRef<HTMLDivElement>(null);
  const [slideWidth,setSlideWidth] = useState(800);

  useEffect(()=>{
    const calc=()=>{
      if(!slideAreaRef.current) return;
      const aw=slideAreaRef.current.clientWidth;
      const ah=window.innerHeight-HEADER_HEIGHT-SUBBAR_HEIGHT;
      const byW=aw-48;
      const availH=ah-PAGINATION_HEIGHT-36;
      const byH=Math.floor(availH/0.5648);
      setSlideWidth(Math.max(740,Math.min(byW,byH,1924)));
    };
    calc();
    window.addEventListener("resize",calc);
    return()=>window.removeEventListener("resize",calc);
  },[aiPanelWidth,aiCollapsed]);

  // ★ 단일 슬라이드 이미지 생성
  const handleGenerateImage = async (page: Page) => {
    setGeneratingImageId(page.id);
    try {
      const result = await fetchSSE(
        "/api/ai-edit",
        { mode:"image", slideContext:page },
        ()=>{}
      ) as any;
      if (result?.background_image) {
        setPages(p=>p.map(pg=>pg.id===page.id
          ? {...pg, background_image:result.background_image, image_prompt:result.image_prompt}
          : pg
        ));
      }
    } catch (e) {
      console.error("이미지 생성 실패:", e);
    }
    setGeneratingImageId(null);
  };

  const exportPDF = () => {
    const pagesHtml = pages.map((p,idx)=>{
      const elems=p.slide.elements||[];
      const heading  = elems.find(e=>e.type==="heading")?.text||"";
      const subtitle = p.slide.subtitle||"";
      const bullets  = elems.filter(e=>e.type==="bullets").flatMap(e=>e.items||[]);
      const circles  = elems.filter(e=>e.type==="circles").flatMap(e=>e.items||[]);
      const emphasis = elems.find(e=>e.type==="emphasis")?.text||"";
      const question = elems.find(e=>e.type==="question")?.text||"";
      const statusColor = p.status==="approved"?"#1A7F45":p.status==="review"?"#B45309":"#666";
      const statusLabel = p.status==="approved"?"승인":p.status==="review"?"검토 중":"수정 필요";
      const bulletsHtml = bullets.length>0
        ?`<ul class="bullets">${bullets.map((b,i)=>`<li><span class="num">${i+1}</span>${b}</li>`).join("")}</ul>`:"";
      const circlesHtml = circles.length>0
        ?`<div class="circles">${circles.map((c,i)=>`<div class="circle"><span class="cnum">${i+1}</span><span>${c}</span></div>`).join("")}</div>`:"";
      return `<div class="slide-page">
        <div class="slide-header">
          <span class="course">${p.course||courseTitle}</span>
          <span class="section">${p.section_name||p.week||"—"}</span>
          <span class="pagenum">p.${idx+1} / ${pages.length}</span>
          <span class="status" style="color:${statusColor}">${statusLabel}</span>
        </div>
        <div class="slide-body">
          ${subtitle?`<div class="sub-label"><span class="bar"></span>${subtitle}</div>`:""}
          ${question?`<div class="question">${question}</div>`:""}
          ${heading?`<div class="heading">${heading}</div>`:""}
          ${emphasis?`<div class="emphasis">${emphasis}</div>`:""}
          ${bulletsHtml}${circlesHtml}
          ${p.screen_desc?`<div class="screen-desc">📷 ${p.screen_desc}</div>`:""}
        </div>
        <div class="narration">${(p.narration||"").replace(/\n/g,"<br>").replace(/#(\d+)/g,'<span class="nar-badge">#$1</span>')}</div>
      </div>`;
    }).join("");
    const html=`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${courseTitle||"스토리보드"}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Noto Sans KR','Malgun Gothic',sans-serif;background:#fff;color:#1C1C1E;font-size:11px}
.slide-page{width:100%;border-bottom:2px solid #E5E5E5;padding:12px 16px 10px;page-break-after:always}.slide-page:last-child{border-bottom:none;page-break-after:auto}
.slide-header{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #F0F0F0}
.course{font-weight:700;color:#1C1C1E;font-size:12px}.section{color:#6C5CE7;font-weight:700;font-size:11px;flex:1}.pagenum{color:#999;font-size:10px}.status{font-size:10px;font-weight:700}
.slide-body{background:#F8F8FC;border-radius:8px;padding:14px 16px;min-height:120px;margin-bottom:8px}
.sub-label{display:flex;align-items:center;gap:5px;color:#64748B;font-size:10px;font-weight:700;margin-bottom:8px}.sub-label .bar{width:3px;height:12px;background:#EF4444;border-radius:2px}
.question{font-size:16px;font-weight:900;color:#1C1C1E;line-height:1.4;margin-bottom:6px}.heading{font-size:18px;font-weight:900;color:#1C1C1E;line-height:1.3;margin-bottom:8px}
.emphasis{font-size:14px;font-weight:700;color:#6C5CE7;margin-top:6px}.screen-desc{font-size:9px;color:#94A3B8;margin-top:8px}
.bullets{list-style:none;margin-top:6px}.bullets li{display:flex;align-items:flex-start;gap:6px;margin-bottom:4px;font-size:11px;color:#334155}
.bullets .num{background:#6C5CE7;color:#fff;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;margin-top:1px}
.circles{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.circle{display:flex;flex-direction:column;align-items:center;gap:3px}
.circle .cnum{background:#EF4444;color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700}
.circle span:last-child{font-size:9px;color:#334155;font-weight:700;text-align:center;max-width:52px}
.narration{background:#fff;border:1px solid #E5E5E5;border-radius:6px;padding:8px 12px;font-size:11px;line-height:1.8;color:#333;word-break:keep-all}
.nar-badge{background:#EF4444;color:#fff;border-radius:3px;padding:1px 4px;font-size:9px;font-weight:700;margin-right:2px}
@media print{body{font-size:10px}.slide-page{padding:10px 14px 8px}.heading{font-size:16px}@page{margin:12mm 10mm;size:A4}}</style>
</head><body>${pagesHtml}<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script></body></html>`;
    const win=window.open("","_blank","width=960,height=700");
    if(win){win.document.write(html);win.document.close();}
  };

  const exportPptx = async () => {
    setIsExportingPptx(true);
    try {
      const res = await fetch("/api/export-pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pages,
          courseTitle,
          week: pages[0]?.week ?? "",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`PPTX 생성 실패: ${err.detail ?? err.error}`);
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${courseTitle ?? "storyboard"}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("PPTX 내보내기 중 오류가 발생했습니다.");
      console.error(e);
    } finally {
      setIsExportingPptx(false);
    }
  };

  const handleMouseDown=useCallback(()=>setIsDragging(true),[]);
  const handleMouseMove=useCallback((e:MouseEvent)=>{
    if(!isDragging||!containerRef.current) return;
    const r=containerRef.current.getBoundingClientRect();
    setAiPanelWidth(Math.max(240,Math.min(e.clientX-r.left,r.width*0.4)));
  },[isDragging]);
  const handleMouseUp=useCallback(()=>setIsDragging(false),[]);
  useEffect(()=>{
    if(isDragging){
      window.addEventListener("mousemove",handleMouseMove);
      window.addEventListener("mouseup",handleMouseUp);
      document.body.style.cursor="ew-resize";
      document.body.style.userSelect="none";
    } else {
      document.body.style.cursor="";
      document.body.style.userSelect="";
    }
    return()=>{
      window.removeEventListener("mousemove",handleMouseMove);
      window.removeEventListener("mouseup",handleMouseUp);
      document.body.style.cursor="";
      document.body.style.userSelect="";
    };
  },[isDragging,handleMouseMove,handleMouseUp]);

  const updatePage=(updated:Page)=>setPages(p=>p.map(pg=>pg.id===updated.id?updated:pg));
  const currentPage=pages[currentIdx];
  const stats={
    approved:pages.filter(p=>p.status==="approved").length,
    review:  pages.filter(p=>p.status==="review").length,
    editing: pages.filter(p=>p.status==="editing").length,
  };

  return (
    <div className="h-screen flex flex-col font-sans bg-muted overflow-hidden">
      <header className="bg-card border-b border-border flex items-center px-4 gap-2.5 shrink-0" style={{height:HEADER_HEIGHT}}>
        <div className="w-6 h-6 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-extrabold text-[13px]">S</div>
        <span className="font-extrabold text-sm text-foreground tracking-tight">StoryKit</span>
        <div className="w-px h-4 bg-border"/>
        <span className="text-xs text-muted-foreground">{courseTitle}</span>
        <Badge variant="secondary" className="text-[10px] font-bold">이러닝 콘텐츠</Badge>
        <div className="ml-auto flex items-center gap-1.5">
          {[{k:"approved",l:"승인"},{k:"review",l:"검토"},{k:"editing",l:"수정"}].map(({k,l})=>(
            <Badge key={k} className={cn(STATUS_CONFIG[k].bgClassName,STATUS_CONFIG[k].className,"text-[11px] font-bold")}>
              {stats[k as keyof typeof stats]} {l}
            </Badge>
          ))}
          <div className="w-px h-4 bg-border"/>
          <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
            {["single","grid4"].map(m=>(
              <Button key={m} variant="ghost" size="sm" onClick={()=>setViewMode(m as "single"|"grid4")}
                className={cn("px-2.5 py-1 text-[11px] font-semibold rounded-md h-auto",
                  viewMode===m?"bg-card text-primary shadow-sm":"text-muted-foreground")}>
                {m==="single"?"1페이지":"4페이지"}
              </Button>
            ))}
          </div>
          <Button size="sm" variant="outline" className="text-xs font-bold gap-1" onClick={exportPptx} disabled={isExportingPptx}>
            {isExportingPptx
              ? <><Loader size={12} className="animate-spin"/>PPTX 생성 중...</>
              : <><Download size={12}/>PPTX 다운로드</>}
          </Button>
          <Button size="sm" className="text-xs font-bold gap-1" onClick={exportPDF}>
            <Download size={12}/>PDF 내보내기
          </Button>
        </div>
      </header>

      <div className="bg-card border-b border-muted flex items-center px-4 gap-3.5 text-xs text-muted-foreground shrink-0" style={{height:SUBBAR_HEIGHT}}>
        <span>총 <strong className="text-foreground">{pages.length}페이지</strong></span>
        <span className="text-border">·</span>
        <span>검수율 <strong className="text-emerald-500">{pages.length>0?Math.round(stats.approved/pages.length*100):0}%</strong></span>
        <span className="text-border">·</span>
        <span className="text-primary text-[11px]">💡 슬라이드 하단 "AI 이미지 생성" 버튼으로 배경 이미지를 생성하세요</span>
        {generatingImageId&&(
          <span className="flex items-center gap-1 text-amber-500 text-[11px]">
            <Loader size={10} className="animate-spin"/> 이미지 생성 중...
          </span>
        )}
        <Button variant="outline" size="sm" className="ml-auto text-[11px] font-semibold gap-1 h-7"
          onClick={()=>setPages(p=>[...p,{...createEmptyPage(p.length+1)}])}>
          <Plus size={10}/>페이지 추가
        </Button>
      </div>

      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        <AiPanel collapsed={aiCollapsed} onToggle={()=>setAiCollapsed(c=>!c)}
          currentPage={currentPage} width={aiPanelWidth}
          onApply={(slide,narration)=>updatePage({...currentPage,slide,narration})}/>
        {!aiCollapsed&&(
          <div onMouseDown={handleMouseDown}
            className={cn("w-1 cursor-ew-resize transition-colors shrink-0 hover:bg-primary",isDragging?"bg-primary":"bg-border")}/>
        )}
        <div ref={slideAreaRef} className="flex-1 flex flex-col overflow-hidden">
          {viewMode==="single" ? (
            <>
              <div className="flex-1 overflow-y-auto flex flex-col items-center" style={{padding:"14px 24px 16px"}}>
                <SlideView
                  page={currentPage} onUpdate={updatePage}
                  slideWidth={slideWidth} indexStructure={indexStructure}
                  onGenerateImage={generatingImageId==null ? handleGenerateImage : undefined}
                />
              </div>
              <div className="shrink-0 flex items-center justify-center gap-2 border-t border-slate-200 bg-white/90 backdrop-blur-sm"
                style={{height:PAGINATION_HEIGHT,paddingBottom:10}}>
                <button onClick={()=>setCurrentIdx(i=>Math.max(0,i-1))} disabled={currentIdx===0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-30 hover:border-slate-400 transition-all">
                  <ChevronLeft size={13}/>이전
                </button>
                <div className="flex gap-1 flex-wrap justify-center" style={{maxWidth:500}}>
                  {pages.map((_,i)=>(
                    <button key={i} onClick={()=>setCurrentIdx(i)}
                      className={cn("w-7 h-7 rounded-lg text-xs font-bold transition-all border",
                        i===currentIdx?"bg-slate-800 text-white border-slate-800":"bg-white text-slate-500 border-slate-200 hover:border-slate-400")}>
                      {i+1}
                    </button>
                  ))}
                </div>
                <button onClick={()=>setCurrentIdx(i=>Math.min(pages.length-1,i+1))} disabled={currentIdx===pages.length-1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 disabled:opacity-30 hover:border-slate-400 transition-all">
                  다음<ChevronRight size={13}/>
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 grid grid-cols-2 gap-4 overflow-auto p-4 content-start">
              {pages.slice(0,4).map((p,i)=>(
                <div key={p.id} className="cursor-pointer hover:ring-2 hover:ring-primary rounded-lg transition-all"
                  onClick={()=>{ setCurrentIdx(i); setViewMode("single"); }}>
                  <SlideView page={p} onUpdate={updatePage} slideWidth={slideWidth/2-8}
                    indexStructure={indexStructure}/>
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
  const [step,setStep]           = useState<"upload"|"generating"|"editor">("upload");
  const [pdfText,setPdfText]     = useState("");
  const [fileName,setFileName]   = useState("");
  const [generatedPages,setGeneratedPages] = useState<Page[]>([]);
  const [generatedIndex,setGeneratedIndex] = useState<IndexChapter[]>([]);
  const [courseTitle,setCourseTitle]       = useState("");

  if (step==="upload") return (
    <UploadScreen onNext={(text,name)=>{ setPdfText(text); setFileName(name); setStep("generating"); }}/>
  );
  if (step==="generating") return (
    <GeneratingScreen pdfText={pdfText} fileName={fileName}
      onDone={(pages,index,title)=>{ setGeneratedPages(pages); setGeneratedIndex(index); setCourseTitle(title); setStep("editor"); }}/>
  );
  return <EditorScreen initialPages={generatedPages} initialIndex={generatedIndex} courseTitle={courseTitle}/>;
}
