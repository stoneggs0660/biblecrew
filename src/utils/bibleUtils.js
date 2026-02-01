/*
 * bibleUtils.js — v08
 * (5개 반 지원 + 반별/월별 일일 분량 생성 + 잠언 분산)
 */

// 전체 성경 목록 (개역개정 66권)
export const BOOKS = [
  { name: '창세기', chapters: 50 },
  { name: '출애굽기', chapters: 40 },
  { name: '레위기', chapters: 27 },
  { name: '민수기', chapters: 36 },
  { name: '신명기', chapters: 34 },
  { name: '여호수아', chapters: 24 },
  { name: '사사기', chapters: 21 },
  { name: '룻기', chapters: 4 },
  { name: '사무엘상', chapters: 31 },
  { name: '사무엘하', chapters: 24 },
  { name: '열왕기상', chapters: 22 },
  { name: '열왕기하', chapters: 25 },
  { name: '역대상', chapters: 29 },
  { name: '역대하', chapters: 36 },
  { name: '에스라', chapters: 10 },
  { name: '느헤미야', chapters: 13 },
  { name: '에스더', chapters: 10 },
  { name: '욥기', chapters: 42 },
  { name: '시편', chapters: 150 },
  { name: '잠언', chapters: 31 },
  { name: '전도서', chapters: 12 },
  { name: '아가', chapters: 8 },
  { name: '이사야', chapters: 66 },
  { name: '예레미야', chapters: 52 },
  { name: '예레미야애가', chapters: 5 },
  { name: '에스겔', chapters: 48 },
  { name: '다니엘', chapters: 12 },
  { name: '호세아', chapters: 14 },
  { name: '요엘', chapters: 3 },
  { name: '아모스', chapters: 9 },
  { name: '오바댜', chapters: 1 },
  { name: '요나', chapters: 4 },
  { name: '미가', chapters: 7 },
  { name: '나훔', chapters: 3 },
  { name: '하박국', chapters: 3 },
  { name: '스바냐', chapters: 3 },
  { name: '학개', chapters: 2 },
  { name: '스가랴', chapters: 14 },
  { name: '말라기', chapters: 4 },

  // 신약
  { name: '마태복음', chapters: 28 },
  { name: '마가복음', chapters: 16 },
  { name: '누가복음', chapters: 24 },
  { name: '요한복음', chapters: 21 },
  { name: '사도행전', chapters: 28 },
  { name: '로마서', chapters: 16 },
  { name: '고린도전서', chapters: 16 },
  { name: '고린도후서', chapters: 13 },
  { name: '갈라디아서', chapters: 6 },
  { name: '에베소서', chapters: 6 },
  { name: '빌립보서', chapters: 4 },
  { name: '골로새서', chapters: 4 },
  { name: '데살로니가전서', chapters: 5 },
  { name: '데살로니가후서', chapters: 3 },
  { name: '디모데전서', chapters: 6 },
  { name: '디모데후서', chapters: 4 },
  { name: '디도서', chapters: 3 },
  { name: '빌레몬서', chapters: 1 },
  { name: '히브리서', chapters: 13 },
  { name: '야고보서', chapters: 5 },
  { name: '베드로전서', chapters: 5 },
  { name: '베드로후서', chapters: 3 },
  { name: '요한1서', chapters: 5 },
  { name: '요한2서', chapters: 1 },
  { name: '요한3서', chapters: 1 },
  { name: '유다서', chapters: 1 },
  { name: '요한계시록', chapters: 22 }
];

// 구약 / 신약 분리
export const OT = BOOKS.slice(0, 39);  // 929장
export const NT = BOOKS.slice(39);     // 260장

export const OT_TOTAL = OT.reduce((a, b) => a + b.chapters, 0);   // 929
export const NT_TOTAL = NT.reduce((a, b) => a + b.chapters, 0);   // 260
export const ALL_TOTAL = OT_TOTAL + NT_TOTAL;                // 1189

// 초급반(구약A/B) 총 장수(설계 확정값)
export const OT_A_TOTAL = 461;
export const OT_B_TOTAL = 468;

// 잠언(31장) 분산: 30일 기준 '1장/일'을 유지하되, 마지막 날에 남은 장을 붙인다.
// (즉, 29일은 1장, 마지막 날은 2장) — 총량 추가 없음.
function getProverbsDailyChapters(days) {
  const total = 31;
  if (days <= 0) return [];
  if (days === 1) return [Array.from({ length: total }, (_, i) => i + 1)];
  const out = [];
  const normalDays = Math.max(0, days - 1);
  // 1~(days-1)
  for (let i = 1; i <= normalDays; i++) {
    out.push([i]);
  }
  // 마지막 날: 나머지 전부
  const last = [];
  for (let ch = normalDays + 1; ch <= total; ch++) last.push(ch);
  out.push(last);
  return out;
}

const ABBREVIATIONS = {
  '창세기': '창', '출애굽기': '출', '레위기': '레', '민수기': '민', '신명기': '신',
  '여호수아': '수', '사사기': '삿', '룻기': '룻', '사무엘상': '삼상', '사무엘하': '삼하',
  '열왕기상': '왕상', '열왕기하': '왕하', '역대상': '대상', '역대하': '대하', '에스라': '스',
  '느헤미야': '느', '에스더': '에', '욥기': '욥', '시편': '시', '잠언': '잠',
  '전도서': '전', '아가': '아', '이사야': '사', '예레미야': '렘', '예레미야애가': '애',
  '에스겔': '겔', '다니엘': '단', '호세아': '호', '요엘': '욜', '아모스': '암',
  '오바댜': '옵', '요나': '욘', '미가': '미', '나훔': '나', '하박국': '합',
  '스바냐': '습', '학개': '학', '스가랴': '슥', '말라기': '말', '마태복음': '마',
  '마가복음': '막', '누가복음': '눅', '요한복음': '요', '사도행전': '행', '로마서': '롬',
  '고린도전서': '고전', '고린도후서': '고후', '갈라디아서': '갈', '에베소서': '엡', '빌립보서': '빌',
  '골로새서': '골', '데살로니가전서': '살전', '데살로니가후서': '살후', '디모데전서': '딤전',
  '디모데후서': '딤후', '디도서': '딛', '빌레몬서': '몬', '히브리서': '히', '야고보서': '약',
  '베드로전서': '벧전', '베드로후서': '벧후', '요한1서': '요일', '요한2서': '요이',
  '요한3서': '요삼', '유다서': '유', '요한계시록': '계'
};

export function getAbbreviation(fullName) {
  return ABBREVIATIONS[fullName] || fullName;
}

function byName(name) {
  return BOOKS.find((b) => b.name === name);
}

function chaptersToItems(bookName, chapters) {
  const arr = [];
  for (let c = 1; c <= chapters; c++) arr.push({ book: bookName, chapter: c });
  return arr;
}

function expandBooks(books) {
  const items = [];
  books.forEach((b) => {
    if (!b) return;
    items.push(...chaptersToItems(b.name, b.chapters));
  });
  return items;
}

// 연속 구간을 보기 좋은 문자열로 요약
function summarizeItems(items) {
  if (!items || items.length === 0) return '';
  const groups = [];
  let cur = { book: items[0].book, start: items[0].chapter, end: items[0].chapter };
  for (let i = 1; i < items.length; i++) {
    const it = items[i];
    if (it.book === cur.book && it.chapter === cur.end + 1) {
      cur.end = it.chapter;
    } else {
      groups.push(cur);
      cur = { book: it.book, start: it.chapter, end: it.chapter };
    }
  }
  groups.push(cur);

  const parts = groups.map((g) => {
    if (g.start === g.end) return `${g.book} ${g.start}장`;
    return `${g.book} ${g.start}장~${g.end}장`;
  });
  return parts.join(' / ');
}

// index(0-based) -> (권, 장)
export function indexToBookChapter(list, index) {
  let remain = index;
  for (let i = 0; i < list.length; i++) {
    if (remain < list[i].chapters) {
      return { book: list[i].name, chapter: remain + 1 };
    }
    remain -= list[i].chapters;
  }
  const last = list[list.length - 1];
  return { book: last.name, chapter: last.chapters };
}

// (권, 장) -> index(0-based)
export function bookChapterToIndex(list, bookName, chapter) {
  let idx = 0;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b.name === bookName) {
      return idx + (chapter - 1);
    }
    idx += b.chapters;
  }
  return -1;
}

// (구버전 호환) 시작~끝 label
function makeRangeLabel(list, start, end) {
  const s = indexToBookChapter(list, start);
  const e = indexToBookChapter(list, end);
  const count = end - start + 1;
  return `${s.book} ${s.chapter}장 ~ ${e.book} ${e.chapter}장 (총 ${count}장)`;
}

// 날짜 수만큼 totalChapters 균등 분배
function divideChapters(totalChapters, days) {
  const base = Math.floor(totalChapters / days);
  let remain = totalChapters % days;
  const arr = [];
  for (let i = 0; i < days; i++) {
    arr.push(base + (remain > 0 ? 1 : 0));
    if (remain > 0) remain--;
  }
  return arr;
}

function buildDailyPlanFromSequence(sequenceItems, dateList) {
  const days = dateList.length;
  const dailyCounts = divideChapters(sequenceItems.length, days);
  let cursor = 0;
  const out = [];
  for (let i = 0; i < days; i++) {
    const count = dailyCounts[i];
    const slice = sequenceItems.slice(cursor, cursor + count);
    cursor += count;
    out.push({ date: dateList[i], items: slice });
  }
  return out;
}

// ─────────────────────────────────────────────────────
// 5개 반용 순서 정의
// ─────────────────────────────────────────────────────

// 구약 초급반 A (1달차)
const OT_A_ORDER = [
  '창세기', '출애굽기', '레위기', '민수기', '신명기',
  '여호수아', '사사기', '룻기', '사무엘상', '사무엘하', '열왕기상', '열왕기하',
  '이사야', '예레미야', '예레미야애가'
];

// 구약 초급반 B (2달차) — 에스더 다음에 시가서(욥/시/전/아가) 후 에스겔 이후
const OT_B_ORDER_EXCEPT_PROVERBS = [
  '역대상', '역대하',
  '에스라', '느헤미야', '에스더',
  '욥기', '시편', '전도서', '아가',
  '에스겔', '다니엘',
  '호세아', '요엘', '아모스', '오바댜', '요나', '미가', '나훔', '하박국', '스바냐', '학개', '스가랴', '말라기'
];

// 중급반: 초급반 A + B 순(구약 전체) + 잠언 분산
const OT_INTERMEDIATE_ORDER_EXCEPT_PROVERBS = [
  ...OT_A_ORDER,
  ...OT_B_ORDER_EXCEPT_PROVERBS
];

// 고급반: 성경 정경 순서(66권)에서 잠언을 분산 처리
const ALL_ORDER_EXCEPT_PROVERBS = [
  ...BOOKS.filter((b) => b.name !== '잠언').map((b) => b.name)
];

// 신약 초급반: 정경 순서
const NT_ORDER = NT.map((b) => b.name);

function makeSequenceFromNames(names) {
  return expandBooks(names.map(byName));
}

const CACHE = {};
function getSequenceForCrew(crewKey) {
  if (CACHE[crewKey]) return CACHE[crewKey];
  let seq = [];
  if (crewKey === '고급반') {
    seq = makeSequenceFromNames(ALL_ORDER_EXCEPT_PROVERBS);
  } else if (crewKey === '중급반') {
    seq = makeSequenceFromNames(OT_INTERMEDIATE_ORDER_EXCEPT_PROVERBS);
  } else if (crewKey === '초급반') {
    seq = makeSequenceFromNames(NT_ORDER);
  } else if (crewKey === '초급반(구약A)') {
    seq = makeSequenceFromNames(OT_A_ORDER);
  } else if (crewKey === '초급반(구약B)') {
    seq = makeSequenceFromNames(OT_B_ORDER_EXCEPT_PROVERBS);
  } else {
    // fallback: 전체
    seq = makeSequenceFromNames(ALL_ORDER_EXCEPT_PROVERBS);
  }
  CACHE[crewKey] = seq;
  return seq;
}

function shouldIncludeProverbsDaily(crewKey) {
  return crewKey === '고급반' || crewKey === '중급반' || crewKey === '초급반(구약B)';
}

import { OT_PANORAMA_SCHEDULE, NT_PANORAMA_SCHEDULE } from '../data/panoramaSchedule.js';

/*
 * bibleRef 파싱 헬퍼 함수
 * 예: "창세기 1-3장" -> [{book:'창세기', chapter:1}, {book:'창세기', chapter:2}, {book:'창세기', chapter:3}]
 * 예: "마태복음 5장" -> [{book:'마태복음', chapter:5}]
 * 예: "여호수아 2-8장 (6-7장 중심)" -> 2~8장 모두 포함 (괄호 내용은 무시하지만 읽기 범위엔 포함)
 * 예: "레위기 11장, 16장, 19장, 23장, 민수기 6장" -> 콤마로 구분된 여러 범위/장
 */
function parseBibleRefV2(refString) {
  const items = [];
  // 1. 콤마로 구분
  const parts = refString.split(',');

  let currentBook = ''; // "11장" 처럼 책 이름이 생략된 경우 이전 책 이름 사용

  for (let part of parts) {
    part = part.trim();
    if (!part) continue;

    // 괄호 내용 제거 (예: "(6-7장 중심)" -> "")
    part = part.replace(/\([^)]*\)/g, '').trim();

    // 책 이름 추출
    // 한글로 시작하는 부분 (공백 포함 가능, 예: 사무엘상)
    const bookMatch = part.match(/^([가-힣]+(?:\s?[가-힣]+)?)/);

    if (bookMatch) {
      currentBook = bookMatch[1].trim();
      part = part.substring(currentBook.length).trim();
    }

    // 이제 part에는 "1-3장", "5장", "1장" 등이 남음
    // "장" 제거
    part = part.replace(/장/g, '').trim();

    // 범위 처리 (1-3)
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let c = start; c <= end; c++) {
          if (currentBook) items.push({ book: currentBook, chapter: c });
        }
      }
    } else {
      // 단일 장
      const ch = parseInt(part, 10);
      if (!isNaN(ch)) {
        if (currentBook) items.push({ book: currentBook, chapter: ch });
      }
    }
  }
  return items;
}


function mergeDays(dayA, dayB) {
  if (!dayA) return dayB;
  if (!dayB) return dayA;
  return {
    day: dayA.day,
    mainTitle: `${dayA.mainTitle} & ${dayB.mainTitle}`,
    sections: [...(dayA.sections || []), ...(dayB.sections || [])]
  };
}


/**
 * 반 이름과 날짜 리스트에 따라 성경 분량을 계산한다.
 * 반환:
 *  - date
 *  - items: [{book, chapter}, ...]
 *  - label: 표시 문자열
 *  - chapters: 장수
 *  - panorama: { mainTitle, subTitle, ... } (파노라마 반인 경우)
 */
export function getDailyBiblePortionByCrew(crewKey, dateList) {
  // 1. 파노라마 반 처리
  if (crewKey === '구약파노라마' || crewKey === '신약파노라마') {
    const originalSchedule = (crewKey === '구약파노라마') ? OT_PANORAMA_SCHEDULE : NT_PANORAMA_SCHEDULE;
    const totalDays = dateList.length;

    // 월별 일수(28, 29, 30, 31)에 따른 스케줄 조정
    let effectiveSchedule = [];

    if (totalDays === 31) {
      // 31일: 30일치 그대로 + 31일차는 휴식
      effectiveSchedule = [...originalSchedule, {
        day: 31,
        mainTitle: "휴식 및 보충",
        sections: [{ subTitle: "지난 분량 복습 및 묵상", bibleRef: "" }]
      }];
    } else if (totalDays === 30) {
      // 30일: 원본 그대로
      effectiveSchedule = [...originalSchedule];
    } else if (totalDays === 29) {
      // 29일(윤년 2월): 1일치 압축 (Day 26+27 병합)
      const merged26_27 = mergeDays(originalSchedule[25], originalSchedule[26]);
      effectiveSchedule = [
        ...originalSchedule.slice(0, 25), // Day 1~25 (idx 0~24)
        merged26_27,                      // Day 26+27 (idx 25)
        ...originalSchedule.slice(27)     // Day 28~30 (idx 27~29) -> becomes idx 26~28 (Day 27~29)
      ];
    } else if (totalDays === 28) {
      // 28일(평년 2월): 2일치 압축 (Day 5+6, Day 26+27 병합)
      const merged5_6 = mergeDays(originalSchedule[4], originalSchedule[5]);    // Day 5+6
      const merged26_27 = mergeDays(originalSchedule[25], originalSchedule[26]); // Day 26+27

      // Day 1~4 (idx 0~3)
      // Day 5+6 (idx 4)
      // Day 7~25 (idx 6~24) -> 19일치
      // Day 26+27 (idx 25)
      // Day 28~30 (idx 26, 27, 28)

      effectiveSchedule = [
        ...originalSchedule.slice(0, 4),   // idx 0,1,2,3 (Day 1,2,3,4)
        merged5_6,                         // idx 4       (Day 5+6)
        ...originalSchedule.slice(6, 25),  // idx 6..24    (Day 7..25)
        merged26_27,                       // idx 25      (Day 26+27)
        ...originalSchedule.slice(27, 30)  // idx 27,28,29 (Day 28..30)
      ];
    } else {
      // 그 외(혹시 모를 상황): 그냥 앞에서부터 자름
      effectiveSchedule = originalSchedule.slice(0, totalDays);
    }

    return dateList.map((dateStr, idx) => {
      const dayIndex = idx;
      if (dayIndex >= effectiveSchedule.length) {
        return { date: dateStr, items: [], chapters: 0, label: '일정 없음' };
      }

      const sch = effectiveSchedule[dayIndex];
      let allItems = [];
      const parsedSections = sch.sections.map(sec => {
        const parsed = parseBibleRefV2(sec.bibleRef);
        allItems = [...allItems, ...parsed];
        return { ...sec, items: parsed };
      });

      // 중복 제거 (혹시 겹치는 범위가 있다면) - items 통합용
      const uniqueItems = allItems.filter((v, i, a) => a.findIndex(t => t.book === v.book && t.chapter === v.chapter) === i);

      const labelCore = summarizeItems(uniqueItems);

      return {
        date: dateStr,
        items: uniqueItems,
        chapters: uniqueItems.length,
        label: `[${sch.mainTitle}] ${labelCore}`, // 홈화면 표시용 (메인제목 + 범위)
        // 파노라마 전용 추가 정보
        panorama: {
          ...sch,
          parsedSections
        }
      };
    });
  }

  const seq = getSequenceForCrew(crewKey);
  const base = buildDailyPlanFromSequence(seq, dateList);

  const includeProv = shouldIncludeProverbsDaily(crewKey);
  const provDaily = includeProv ? getProverbsDailyChapters(dateList.length) : [];

  return base.map((d, idx) => {
    let items = d.items;
    if (includeProv) {
      const provChs = provDaily[idx] || [];
      const provItems = provChs.map((ch) => ({ book: '잠언', chapter: ch }));
      // 잠언을 하루 분량 끝에 붙임
      items = [...items, ...provItems];
    }
    const chapters = items.length;
    const labelCore = summarizeItems(items);
    const label = `${labelCore} (총 ${chapters}장)`;
    return {
      date: d.date,
      items,
      chapters,
      label,
    };
  });
}
