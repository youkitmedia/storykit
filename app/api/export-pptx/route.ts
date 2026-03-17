// ╔══════════════════════════════════════════════════════════════════╗
// ║  StoryKit PPTX 내보내기 API                                     ║
// ║  파일 위치: app/api/export-pptx/route.ts                        ║
// ║                                                                  ║
// ║  Manus 방식:                                                     ║
// ║  - Nano Banana 2 생성 이미지 → 슬라이드 배경 (full-bleed)        ║
// ║  - 제목·나레이션 → 편집 가능한 텍스트 레이어                     ║
// ║  - 이미지 없는 슬라이드 → pptxgenjs 도형으로 레이아웃 직접 구성  ║
// ╚══════════════════════════════════════════════════════════════════╝

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// ── 타입 ──────────────────────────────────────────────
interface SlideElement {
  id: string; order: number; type: string;
  text?: string; items?: string[];
  cue?: number; style?: string; active?: number;
}
interface Slide {
  title: string; subtitle?: string;
  layout: string; elements: SlideElement[];
}
interface Page {
  id: number; page_id: string;
  course?: string; week?: string; section_name?: string;
  chapter_index: number; item_index: number;
  status: string;
  slide: Slide; screen_desc: string; narration: string;
  background_image?: string; // base64 PNG (Nano Banana 2)
  image_prompt?: string;
}
interface ExportRequest {
  pages: Page[];
  courseTitle?: string;
  week?: string;
}

// ── 색상 팔레트 (이러닝 전용) ──────────────────────────
const COLORS = {
  primary:    "1D293D",  // 진네이비
  accent:     "EF4444",  // 레드 (큐 배지)
  accentBlue: "3B82F6",  // 블루
  white:      "FFFFFF",
  offWhite:   "F8FAFC",
  lightGray:  "E2E8F0",
  darkGray:   "64748B",
  narBg:      "1E293B",  // 나레이션 배경
  darkGreen:  "1A3D2B",  // summary_dark 배경
  amber:      "F59E0B",
  amberLight: "FEF3C7",
  skyBlue:    "38BDF8",
  skyLight:   "E0F7FF",
};

// ── 큐 배지 헬퍼 ──────────────────────────────────────
function addCueBadge(
  slide: any, num: number,
  x: number, y: number, size = 0.22
) {
  slide.addShape("rect", {
    x, y, w: size * 1.6, h: size,
    fill: { color: COLORS.accent },
    line: { color: COLORS.accent },
    rectRadius: 0.03,
  });
  slide.addText(`#${num}`, {
    x, y, w: size * 1.6, h: size,
    fontSize: 8, bold: true,
    color: COLORS.white,
    align: "center", valign: "middle",
    margin: 0,
  });
}

// ── 강사 실루엣 SVG → base64 ───────────────────────────
function getInstructorSvgBase64(color = "D1D5DB"): string {
  const svg = `<svg viewBox="0 0 160 320" xmlns="http://www.w3.org/2000/svg" fill="#${color}">
    <circle cx="80" cy="52" r="38"/>
    <rect x="18" y="110" width="124" height="200" rx="30" ry="30"/>
  </svg>`;
  return "image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

// ══════════════════════════════════════════════════════
// 레이아웃별 슬라이드 빌더
// ══════════════════════════════════════════════════════

// ── 공통: 배경 이미지 + 나레이션 바 추가 ──────────────
function addCommonElements(
  slide: any,
  page: Page,
  pres: any,
  opts: { hasBackground: boolean; darkNarr?: boolean }
) {
  const W = 10, H = 5.625;

  if (page.background_image && opts.hasBackground) {
    slide.addImage({
      data: `image/png;base64,${page.background_image}`,
      x: 0, y: 0, w: W, h: H,
      sizing: { type: "cover", w: W, h: H },
    });
    slide.addShape("rect", {
      x: 0, y: 0, w: W, h: H,
      fill: { color: "000000", transparency: 45 },
      line: { color: "000000", transparency: 100 },
    });
  }

  const narrY = H - 1.05;
  slide.addShape("rect", {
    x: 0, y: narrY, w: W, h: 1.05,
    fill: { color: COLORS.narBg },
    line: { color: COLORS.narBg },
  });
  slide.addShape("rect", {
    x: 0, y: narrY, w: 0.28, h: 1.05,
    fill: { color: "0F172A" },
    line: { color: "0F172A" },
  });
  slide.addText("나레이션", {
    x: 0, y: narrY, w: 0.28, h: 1.05,
    fontSize: 7, bold: true, color: COLORS.white,
    align: "center", valign: "middle",
    margin: 0,
    rotate: 270,
  });

  const narrText = (page.narration || "").replace(/#\d+\s*/g, "").trim();
  slide.addText(narrText, {
    x: 0.35, y: narrY + 0.08, w: W - 0.45, h: 0.9,
    fontSize: 9, color: "CBD5E1",
    align: "left", valign: "top",
    wrap: true, margin: 0,
  });

  slide.addText(`${page.course || ""} · ${page.page_id || ""}`, {
    x: W - 2.5, y: H - 0.22, w: 2.4, h: 0.18,
    fontSize: 6, color: "94A3B8",
    align: "right", margin: 0,
  });
}

// ── A. title_intro ────────────────────────────────────
function buildTitleIntro(slide: any, page: Page, pres: any) {
  const el = page.slide.elements ?? [];
  const heading = el.find(e => e.type === "heading")?.text ?? page.slide.title;
  const subtitle = page.slide.subtitle ?? "";
  const bullets  = el.find(e => e.type === "bullets")?.items ?? [];
  const hasBg    = !!page.background_image;

  if (!hasBg) {
    slide.background = { color: "F5F5F0" };
    slide.addShape("oval", {
      x: 6.5, y: 0.3, w: 3.2, h: 3.2,
      fill: { color: COLORS.lightGray, transparency: 60 },
      line: { color: COLORS.primary, width: 8 },
    });
    slide.addShape("rect", {
      x: 7.2, y: 0.1, w: 2.5, h: 2.5,
      fill: { color: COLORS.lightGray, transparency: 80 },
      line: { color: "CCCCCC", width: 1 },
    });
    slide.addShape("line", {
      x: 7.8, y: 0, w: 1.2, h: 2.8,
      line: { color: COLORS.accent, width: 6 },
    });
  }

  slide.addShape("rect", {
    x: 0.4, y: 0.35, w: 5.5, h: hasBg ? 1.4 : 1.6,
    fill: { color: hasBg ? "1D293D" : COLORS.primary, transparency: hasBg ? 20 : 0 },
    line: { color: COLORS.primary },
  });
  slide.addText(heading, {
    x: 0.5, y: 0.4, w: 5.3, h: hasBg ? 1.3 : 1.5,
    fontSize: hasBg ? 28 : 32, bold: true,
    color: COLORS.white,
    align: "left", valign: "middle",
    wrap: true, margin: 0.1,
  });

  if (subtitle) {
    slide.addShape("rect", {
      x: 0.4, y: hasBg ? 1.9 : 2.1, w: subtitle.length * 0.14 + 0.4, h: 0.3,
      fill: { color: COLORS.primary },
      line: { color: COLORS.primary },
    });
    slide.addText(subtitle, {
      x: 0.5, y: hasBg ? 1.9 : 2.1, w: subtitle.length * 0.14 + 0.2, h: 0.3,
      fontSize: 10, bold: true, color: COLORS.white,
      align: "left", valign: "middle", margin: 0,
    });
  }

  if (bullets.length > 0) {
    const bulletY = hasBg ? 2.35 : 2.55;
    slide.addShape("rect", {
      x: 0.4, y: bulletY, w: 5.5, h: bullets.length * 0.32 + 0.15,
      fill: { color: "111827", transparency: hasBg ? 30 : 0 },
      line: { color: "111827" },
    });
    bullets.forEach((b, i) => {
      slide.addText(`♪  ${b}`, {
        x: 0.55, y: bulletY + 0.08 + i * 0.32, w: 5.2, h: 0.28,
        fontSize: 10, color: COLORS.white,
        align: "left", valign: "middle", margin: 0,
      });
    });
  }

  slide.addImage({
    data: getInstructorSvgBase64(hasBg ? "FFFFFF" : "D1D5DB"),
    x: 7.8, y: 1.8, w: 1.6, h: 3.2,
  });
  addCommonElements(slide, page, pres, { hasBackground: hasBg });
}

// ── B. split_two ──────────────────────────────────────
function buildSplitTwo(slide: any, page: Page, pres: any) {
  const el      = page.slide.elements ?? [];
  const heading = page.slide.title ?? "";
  const subtitle = page.slide.subtitle ?? "";
  const circles = el.find(e => e.type === "circles")?.items ?? [];
  const hasBg   = !!page.background_image;
  const [leftLabel, rightLabel] = circles.length >= 2
    ? [circles[0], circles[1]] : ["파트 1", "파트 2"];

  if (!hasBg) slide.background = { color: "F0F0EA" };

  slide.addText(heading, {
    x: 0.4, y: 0.18, w: 7, h: 0.48,
    fontSize: 20, bold: true,
    color: hasBg ? COLORS.white : COLORS.primary,
    align: "left", valign: "middle", margin: 0,
  });
  if (subtitle) {
    slide.addShape("rect", {
      x: 0.4, y: 0.7, w: subtitle.length * 0.13 + 0.4, h: 0.26,
      fill: { color: COLORS.primary, transparency: hasBg ? 30 : 0 },
      line: { color: COLORS.primary },
    });
    slide.addText(subtitle, {
      x: 0.5, y: 0.7, w: subtitle.length * 0.13 + 0.2, h: 0.26,
      fontSize: 9, bold: true, color: COLORS.white,
      align: "left", valign: "middle", margin: 0,
    });
  }

  const circleY = 1.1, circleR = 1.55;
  slide.addShape("oval", {
    x: 1.0, y: circleY, w: circleR * 2, h: circleR * 2,
    fill: { color: hasBg ? "1D293D" : COLORS.white, transparency: hasBg ? 30 : 0 },
    line: { color: COLORS.primary, width: 8 },
  });
  slide.addText(leftLabel, {
    x: 1.1, y: circleY + 0.4, w: circleR * 1.8, h: circleR,
    fontSize: 13, bold: true,
    color: hasBg ? COLORS.white : COLORS.primary,
    align: "center", valign: "middle", wrap: true, margin: 0,
  });
  addCueBadge(slide, 1, 1.6, circleY + 0.05);

  slide.addText("▶", {
    x: 4.75, y: circleY + circleR - 0.28, w: 0.45, h: 0.56,
    fontSize: 22, color: COLORS.accentBlue,
    align: "center", valign: "middle", margin: 0,
  });

  slide.addShape("oval", {
    x: 5.45, y: circleY, w: circleR * 2, h: circleR * 2,
    fill: { color: hasBg ? "334155" : "CCCCCC", transparency: hasBg ? 20 : 0 },
    line: { color: hasBg ? "94A3B8" : "999999", width: 2 },
  });
  slide.addText(rightLabel, {
    x: 5.55, y: circleY + 0.4, w: circleR * 1.8, h: circleR,
    fontSize: 13, bold: true,
    color: hasBg ? COLORS.white : COLORS.primary,
    align: "center", valign: "middle", wrap: true, margin: 0,
  });
  addCueBadge(slide, 2, 6.0, circleY + 0.05);

  addCommonElements(slide, page, pres, { hasBackground: hasBg });
}

// ── C. concept_circles ────────────────────────────────
function buildConceptCircles(slide: any, page: Page, pres: any) {
  const el      = page.slide.elements ?? [];
  const heading = page.slide.title ?? "";
  const circles = el.find(e => e.type === "circles")?.items ?? [];
  const emphasis = el.find(e => e.type === "emphasis")?.text ?? "";
  const emphCue  = el.find(e => e.type === "emphasis")?.cue;
  const hasBg   = !!page.background_image;

  if (!hasBg) slide.background = { color: "F5F5F0" };

  slide.addText(heading, {
    x: 0.4, y: 0.15, w: 9, h: 0.5,
    fontSize: 20, bold: true,
    color: hasBg ? COLORS.white : COLORS.primary,
    align: "left", valign: "middle", margin: 0,
  });

  const circColors = ["3B82F6", "10B981", "F59E0B", "8B5CF6"];
  const count = Math.min(circles.length, 4);
  const cW = 1.5, gap = 0.2;
  const totalW = count * cW + (count - 1) * gap;
  const startX = (10 - totalW) / 2;
  const cY = 0.85;

  circles.slice(0, count).forEach((item, i) => {
    const cx = startX + i * (cW + gap);
    const cue = el.find(e => e.type === "circles")?.cue;

    slide.addShape("oval", {
      x: cx, y: cY, w: cW, h: cW,
      fill: { color: circColors[i % 4], transparency: hasBg ? 20 : 30 },
      line: { color: circColors[i % 4], width: 2 },
    });
    slide.addText(item, {
      x: cx + 0.05, y: cY + 0.3, w: cW - 0.1, h: cW - 0.6,
      fontSize: 12, bold: true,
      color: hasBg ? COLORS.white : circColors[i % 4],
      align: "center", valign: "middle", wrap: true, margin: 0,
    });
    if (i === 0 && cue != null) addCueBadge(slide, cue, cx, cY);

    if (i < count - 1) {
      slide.addText("→", {
        x: cx + cW + 0.02, y: cY + cW / 2 - 0.18, w: gap, h: 0.36,
        fontSize: 14, color: hasBg ? COLORS.white : COLORS.darkGray,
        align: "center", valign: "middle", margin: 0,
      });
    }
  });

  if (emphasis) {
    const empY = cY + cW + 0.25;
    slide.addShape("rect", {
      x: 1.5, y: empY, w: 7, h: 0.5,
      fill: { color: COLORS.amber, transparency: hasBg ? 20 : 40 },
      line: { color: COLORS.amber },
    });
    slide.addText(emphasis, {
      x: 1.6, y: empY, w: 6.8, h: 0.5,
      fontSize: 11, bold: true,
      color: hasBg ? COLORS.white : "78350F",
      align: "center", valign: "middle", margin: 0,
    });
    if (emphCue != null) addCueBadge(slide, emphCue, 1.5, empY);
  }

  slide.addImage({
    data: getInstructorSvgBase64(hasBg ? "FFFFFF" : "D1D5DB"),
    x: 8.2, y: 1.5, w: 1.4, h: 2.8,
  });
  addCommonElements(slide, page, pres, { hasBackground: hasBg });
}

// ── D. tabs_sequential ────────────────────────────────
function buildTabsSequential(slide: any, page: Page, pres: any) {
  const el       = page.slide.elements ?? [];
  const heading  = page.slide.title ?? "";
  const emphasis = el.find(e => e.type === "emphasis")?.text ?? "";
  const emphCue  = el.find(e => e.type === "emphasis")?.cue;
  const tabs     = el.find(e => e.type === "tabs")?.items
                ?? el.find(e => e.type === "bullets")?.items ?? [];
  const tabEl    = el.find(e => e.type === "tabs") ?? el.find(e => e.type === "bullets");
  const hasBg    = !!page.background_image;

  if (!hasBg) slide.background = { color: "F5F5F0" };

  slide.addText(heading, {
    x: 0.4, y: 0.15, w: 7, h: 0.45,
    fontSize: 18, bold: true,
    color: hasBg ? COLORS.white : COLORS.primary,
    align: "left", valign: "middle", margin: 0,
  });

  if (emphasis) {
    slide.addShape("rect", {
      x: 0.4, y: 0.72, w: 7.5, h: 0.52,
      fill: { color: "0EA5E9" },
      line: { color: "0EA5E9" },
    });
    slide.addText(`#1  ${emphasis}`, {
      x: 0.5, y: 0.72, w: 7.3, h: 0.52,
      fontSize: 13, bold: true, color: COLORS.white,
      align: "left", valign: "middle", margin: 0,
    });
    if (emphCue != null) addCueBadge(slide, emphCue, 0.4, 0.72);
  }

  const tabW  = tabs.length > 0 ? Math.min(2.4, 7.5 / tabs.length) : 2.4;
  const tabGap = 0.1;
  const tabStartX = 0.4;
  const tabY = emphasis ? 1.38 : 0.85;

  tabs.slice(0, 4).forEach((t, i) => {
    const tx = tabStartX + i * (tabW + tabGap);
    const cue = tabEl?.cue;

    slide.addShape("rect", {
      x: tx, y: tabY, w: tabW, h: 2.2,
      fill: { color: hasBg ? "1E293B" : COLORS.white, transparency: hasBg ? 25 : 0 },
      line: { color: COLORS.lightGray, width: 1 },
    });
    slide.addShape("oval", {
      x: tx + tabW / 2 - 0.22, y: tabY - 0.22, w: 0.44, h: 0.44,
      fill: { color: i === 0 ? COLORS.accent : COLORS.primary },
      line: { color: i === 0 ? COLORS.accent : COLORS.primary },
    });
    slide.addText(`${i + 1}`, {
      x: tx + tabW / 2 - 0.22, y: tabY - 0.22, w: 0.44, h: 0.44,
      fontSize: 11, bold: true, color: COLORS.white,
      align: "center", valign: "middle", margin: 0,
    });
    slide.addText(t, {
      x: tx + 0.1, y: tabY + 0.15, w: tabW - 0.2, h: 1.9,
      fontSize: 11, bold: i === 0,
      color: hasBg ? (i === 0 ? COLORS.white : "94A3B8") : (i === 0 ? COLORS.primary : COLORS.darkGray),
      align: "center", valign: "middle", wrap: true, margin: 0.05,
    });
    if (i === 0 && cue != null) addCueBadge(slide, cue, tx, tabY + 0.3);
  });

  slide.addImage({
    data: getInstructorSvgBase64(hasBg ? "FFFFFF" : "D1D5DB"),
    x: 8.2, y: 1.5, w: 1.4, h: 2.8,
  });
  addCommonElements(slide, page, pres, { hasBackground: hasBg });
}

// ── E. emphasis_definition / image_caption ────────────
function buildEmphasisDefinition(slide: any, page: Page, pres: any) {
  const el       = page.slide.elements ?? [];
  const heading  = page.slide.title ?? "";
  const subtitle = page.slide.subtitle ?? "";
  const emphasis = el.find(e => e.type === "emphasis")?.text ?? "";
  const emphCue  = el.find(e => e.type === "emphasis")?.cue;
  const bullets  = el.find(e => e.type === "bullets");
  const hasBg    = !!page.background_image;

  if (!hasBg) slide.background = { color: "F5F5F0" };

  slide.addText(heading, {
    x: 0.4, y: 0.15, w: 7.5, h: 0.45,
    fontSize: 20, bold: true,
    color: hasBg ? COLORS.white : COLORS.primary,
    align: "left", valign: "middle", margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.4, y: 0.65, w: 7, h: 0.3,
      fontSize: 11, color: hasBg ? "94A3B8" : COLORS.darkGray,
      align: "left", valign: "middle", margin: 0,
    });
  }

  if (emphasis) {
    const empY = subtitle ? 1.1 : 0.75;
    slide.addShape("rect", {
      x: 0.4, y: empY, w: 0.06, h: 0.65,
      fill: { color: COLORS.amber },
      line: { color: COLORS.amber },
    });
    slide.addShape("rect", {
      x: 0.5, y: empY, w: 7.3, h: 0.65,
      fill: { color: hasBg ? "1E293B" : COLORS.amberLight, transparency: hasBg ? 25 : 0 },
      line: { color: hasBg ? "334155" : "FDE68A", width: 1 },
    });
    slide.addText(emphasis, {
      x: 0.65, y: empY, w: 7.0, h: 0.65,
      fontSize: 13, bold: true,
      color: hasBg ? COLORS.white : "78350F",
      align: "left", valign: "middle", wrap: true, margin: 0.05,
    });
    if (emphCue != null) addCueBadge(slide, emphCue, 0.5, empY + 0.05);
  }

  if (bullets && bullets.items && bullets.items.length > 0) {
    const bullY = emphasis ? (subtitle ? 1.9 : 1.55) : (subtitle ? 1.05 : 0.75);
    const bulletCue = bullets.cue;
    bullets.items.slice(0, 4).forEach((b, i) => {
      const bY = bullY + i * 0.45;
      slide.addShape("rect", {
        x: 0.4, y: bY, w: 7.3, h: 0.38,
        fill: { color: hasBg ? "1E293B" : COLORS.white, transparency: hasBg ? 25 : 0 },
        line: { color: COLORS.lightGray, width: 1 },
      });
      slide.addShape("oval", {
        x: 0.5, y: bY + 0.05, w: 0.28, h: 0.28,
        fill: { color: i === 0 ? COLORS.accent : COLORS.primary, transparency: i === 0 ? 0 : 30 },
        line: { color: i === 0 ? COLORS.accent : COLORS.primary },
      });
      slide.addText(`${i + 1}`, {
        x: 0.5, y: bY + 0.05, w: 0.28, h: 0.28,
        fontSize: 8, bold: true, color: COLORS.white,
        align: "center", valign: "middle", margin: 0,
      });
      slide.addText(b, {
        x: 0.85, y: bY + 0.03, w: 6.8, h: 0.32,
        fontSize: 12,
        color: hasBg ? (i === 0 ? COLORS.white : "94A3B8") : COLORS.primary,
        align: "left", valign: "middle", margin: 0, bold: i === 0,
      });
      if (i === 0 && bulletCue != null) addCueBadge(slide, bulletCue, 0.4, bY + 0.04);
    });
  }

  slide.addImage({
    data: getInstructorSvgBase64(hasBg ? "FFFFFF" : "D1D5DB"),
    x: 8.1, y: 1.5, w: 1.5, h: 3.0,
  });
  addCommonElements(slide, page, pres, { hasBackground: hasBg });
}

// ── F. speech_bubble ──────────────────────────────────
function buildSpeechBubble(slide: any, page: Page, pres: any) {
  const el       = page.slide.elements ?? [];
  const heading  = page.slide.title ?? "";
  const question = el.find(e => e.type === "question");
  const speech   = el.find(e => e.type === "speech") ?? el.find(e => e.type === "emphasis");
  const hasBg    = !!page.background_image;

  if (!hasBg) slide.background = { color: "F5F5F0" };

  slide.addText(heading, {
    x: 0.4, y: 0.15, w: 8, h: 0.45,
    fontSize: 20, bold: true,
    color: hasBg ? COLORS.white : COLORS.primary,
    align: "left", valign: "middle", margin: 0,
  });

  if (question) {
    slide.addShape("rect", {
      x: 0.5, y: 0.75, w: 7, h: 1.1,
      fill: { color: hasBg ? "1E293B" : "FFF9F0", transparency: hasBg ? 20 : 0 },
      line: { color: hasBg ? "475569" : "FCD34D", width: 2 },
    });
    slide.addText(question.text ?? "", {
      x: 0.7, y: 0.75, w: 6.6, h: 1.1,
      fontSize: 15, bold: true,
      color: hasBg ? COLORS.white : COLORS.primary,
      align: "left", valign: "middle", wrap: true, margin: 0.1,
    });
    if (question.cue != null) addCueBadge(slide, question.cue, 0.5, 0.8);
  }

  if (speech) {
    slide.addShape("rect", {
      x: 0.5, y: 2.05, w: 7, h: 1.1,
      fill: { color: "166534", transparency: hasBg ? 20 : 0 },
      line: { color: "166534" },
    });
    slide.addText(speech.text ?? "", {
      x: 0.7, y: 2.05, w: 6.6, h: 1.1,
      fontSize: 13, bold: true, color: COLORS.white,
      align: "left", valign: "middle", wrap: true, margin: 0.1,
    });
    if (speech.cue != null) addCueBadge(slide, speech.cue, 0.5, 2.1);
  }

  slide.addImage({
    data: getInstructorSvgBase64(hasBg ? "FFFFFF" : "D1D5DB"),
    x: 7.8, y: 1.4, w: 1.8, h: 3.2,
  });
  addCommonElements(slide, page, pres, { hasBackground: hasBg });
}

// ── G. label_list ─────────────────────────────────────
function buildLabelList(slide: any, page: Page, pres: any) {
  const el      = page.slide.elements ?? [];
  const heading = page.slide.title ?? "";
  const labels  = el.find(e => e.type === "label_list")?.items
               ?? el.find(e => e.type === "bullets")?.items ?? [];
  const labelEl = el.find(e => e.type === "label_list") ?? el.find(e => e.type === "bullets");
  const hasBg   = !!page.background_image;

  if (!hasBg) slide.background = { color: "F5F5F0" };

  slide.addText(heading, {
    x: 0.4, y: 0.15, w: 7.5, h: 0.45,
    fontSize: 20, bold: true,
    color: hasBg ? COLORS.white : COLORS.primary,
    align: "left", valign: "middle", margin: 0,
  });

  labels.slice(0, 4).forEach((label, i) => {
    const lY = 0.8 + i * 0.6;
    const isActive = i === 0;
    slide.addShape("rect", {
      x: 0.4, y: lY, w: 7, h: 0.48,
      fill: { color: isActive ? "166534" : (hasBg ? "1E293B" : "E5E7EB"), transparency: hasBg ? 20 : 0 },
      line: { color: isActive ? "166534" : (hasBg ? "334155" : "D1D5DB"), width: 1 },
    });
    slide.addShape("oval", {
      x: 0.5, y: lY + 0.07, w: 0.34, h: 0.34,
      fill: { color: isActive ? COLORS.white : COLORS.darkGray },
      line: { color: isActive ? COLORS.white : COLORS.darkGray },
    });
    slide.addText(`${i + 1}`, {
      x: 0.5, y: lY + 0.07, w: 0.34, h: 0.34,
      fontSize: 9, bold: true,
      color: isActive ? "166534" : COLORS.white,
      align: "center", valign: "middle", margin: 0,
    });
    slide.addText(label, {
      x: 0.95, y: lY + 0.04, w: 6.3, h: 0.4,
      fontSize: 12, bold: isActive,
      color: isActive ? COLORS.white : (hasBg ? "94A3B8" : COLORS.primary),
      align: "left", valign: "middle", margin: 0,
    });
    if (i === 0 && labelEl?.cue != null) addCueBadge(slide, labelEl.cue, 0.4, lY + 0.04);
  });

  slide.addImage({
    data: getInstructorSvgBase64(hasBg ? "FFFFFF" : "D1D5DB"),
    x: 7.9, y: 1.5, w: 1.7, h: 3.0,
  });
  addCommonElements(slide, page, pres, { hasBackground: hasBg });
}

// ── H. summary_dark ───────────────────────────────────
function buildSummaryDark(slide: any, page: Page, pres: any) {
  const el      = page.slide.elements ?? [];
  const heading = page.slide.title ?? "";
  const subtitle = page.slide.subtitle ?? "";
  const bullets = el.find(e => e.type === "bullets")?.items ?? [];
  const hasBg   = !!page.background_image;

  if (!hasBg) {
    slide.background = { color: COLORS.darkGreen };
  } else {
    slide.addImage({
      data: `image/png;base64,${page.background_image}`,
      x: 0, y: 0, w: 10, h: 5.625,
      sizing: { type: "cover", w: 10, h: 5.625 },
    });
    slide.addShape("rect", {
      x: 0, y: 0, w: 10, h: 5.625,
      fill: { color: COLORS.darkGreen, transparency: 25 },
      line: { color: COLORS.darkGreen },
    });
  }

  slide.addText(heading, {
    x: 0.4, y: 0.2, w: 7.5, h: 0.55,
    fontSize: 22, bold: true, color: COLORS.white,
    align: "left", valign: "middle", margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.4, y: 0.8, w: 7, h: 0.3,
      fontSize: 11, color: "8AAB96",
      align: "left", valign: "middle", margin: 0,
    });
  }

  const cardStartY = subtitle ? 1.2 : 0.9;
  bullets.slice(0, 3).forEach((b, i) => {
    const cardY = cardStartY + i * 0.72;
    slide.addShape("rect", {
      x: 0.4, y: cardY, w: 7.2, h: 0.6,
      fill: { color: "F5F0E0" },
      line: { color: "E5E0D0", width: 1 },
    });
    slide.addShape("rect", {
      x: 0.4, y: cardY, w: 0.06, h: 0.6,
      fill: { color: "0D9488" },
      line: { color: "0D9488" },
    });
    addCueBadge(slide, i + 1, 0.5, cardY + 0.12, 0.2);
    slide.addText(b, {
      x: 0.85, y: cardY + 0.06, w: 6.6, h: 0.48,
      fontSize: 12, bold: true, color: COLORS.primary,
      align: "left", valign: "middle", margin: 0,
    });
  });

  slide.addShape("oval", {
    x: 7.9, y: 1.0, w: 1.7, h: 1.7,
    fill: { color: COLORS.darkGreen, transparency: 20 },
    line: { color: "8AAB96", width: 3 },
  });
  slide.addImage({
    data: getInstructorSvgBase64("AAAAAA"),
    x: 8.0, y: 1.05, w: 1.5, h: 1.6,
  });

  const narrY = 5.625 - 1.05;
  slide.addShape("rect", {
    x: 0, y: narrY, w: 10, h: 1.05,
    fill: { color: "0F1F17" },
    line: { color: "0F1F17" },
  });
  slide.addShape("rect", {
    x: 0, y: narrY, w: 0.28, h: 1.05,
    fill: { color: "06110D" },
    line: { color: "06110D" },
  });
  slide.addText("나레이션", {
    x: 0, y: narrY, w: 0.28, h: 1.05,
    fontSize: 7, bold: true, color: "8AAB96",
    align: "center", valign: "middle", margin: 0, rotate: 270,
  });
  const narrText = (page.narration || "").replace(/#\d+\s*/g, "").trim();
  slide.addText(narrText, {
    x: 0.35, y: narrY + 0.08, w: 9.55, h: 0.9,
    fontSize: 9, color: "8AAB96",
    align: "left", valign: "top", wrap: true, margin: 0,
  });
}

// ── 폴백: 기본 레이아웃 ──────────────────────────────
function buildDefault(slide: any, page: Page, pres: any) {
  const el      = page.slide.elements ?? [];
  const heading = page.slide.title ?? "";
  const hasBg   = !!page.background_image;

  if (!hasBg) slide.background = { color: "F5F5F0" };

  slide.addText(heading, {
    x: 0.4, y: 0.2, w: 9, h: 0.6,
    fontSize: 22, bold: true,
    color: hasBg ? COLORS.white : COLORS.primary,
    align: "left", valign: "middle", margin: 0,
  });

  let y = 1.0;
  el.forEach((e) => {
    if (e.type === "heading") return;
    if (e.text) {
      slide.addText(e.text, {
        x: 0.5, y, w: 7.5, h: 0.45,
        fontSize: 12, color: hasBg ? COLORS.white : COLORS.primary,
        align: "left", valign: "middle", margin: 0,
      });
      if (e.cue != null) addCueBadge(slide, e.cue, 0.5, y + 0.04);
      y += 0.55;
    }
    if (e.items) {
      e.items.forEach((item, idx) => {
        slide.addText(`  ${idx + 1}.  ${item}`, {
          x: 0.5, y, w: 7.5, h: 0.38,
          fontSize: 11, color: hasBg ? "CBD5E1" : COLORS.darkGray,
          align: "left", valign: "middle", margin: 0,
        });
        y += 0.42;
      });
    }
  });

  slide.addImage({
    data: getInstructorSvgBase64(hasBg ? "FFFFFF" : "D1D5DB"),
    x: 8.1, y: 1.5, w: 1.5, h: 3.0,
  });
  addCommonElements(slide, page, pres, { hasBackground: hasBg });
}

// ══════════════════════════════════════════════════════
// 메인 PPTX 생성 함수
// ══════════════════════════════════════════════════════
async function buildPptx(data: ExportRequest): Promise<Buffer> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pres = new PptxGenJS();
  pres.layout  = "LAYOUT_16x9";
  pres.author  = "StoryKit AI";
  pres.title   = data.courseTitle ?? "스토리보드";
  pres.subject = data.week ?? "";

  for (const page of data.pages) {
    const slide  = pres.addSlide();
    const layout = page.layout ?? page.slide?.layout ?? "";

    switch (layout) {
      case "title_intro":
        buildTitleIntro(slide, page, pres); break;
      case "split_two":
        buildSplitTwo(slide, page, pres); break;
      case "concept_circles":
      case "concept_bullets":
        buildConceptCircles(slide, page, pres); break;
      case "tabs_sequential":
        buildTabsSequential(slide, page, pres); break;
      case "emphasis_definition":
      case "image_caption":
        buildEmphasisDefinition(slide, page, pres); break;
      case "speech_bubble":
      case "question_check":
        buildSpeechBubble(slide, page, pres); break;
      case "label_list":
        buildLabelList(slide, page, pres); break;
      case "summary_dark":
        buildSummaryDark(slide, page, pres); break;
      default:
        buildDefault(slide, page, pres);
    }

    if (page.narration) {
      slide.addNotes(page.narration);
    }
  }

  const buffer = await pres.write({ outputType: "nodebuffer" }) as Buffer;
  return buffer;
}

// ── API 핸들러 ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body: ExportRequest = await req.json();

    if (!body.pages || body.pages.length === 0) {
      return NextResponse.json({ error: "pages 데이터 필요" }, { status: 400 });
    }

    const buffer = await buildPptx(body);
    const fileName = `${(body.courseTitle ?? "storyboard").replace(/\s+/g, "_")}.pptx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Content-Length":      String(buffer.length),
      },
    });
  } catch (err) {
    console.error("PPTX Export Error:", err);
    return NextResponse.json(
      { error: "PPTX 생성 실패", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
