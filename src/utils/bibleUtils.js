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

export const OT_TOTAL = OT.reduce((a,b)=>a+b.chapters, 0);   // 929
export const NT_TOTAL = NT.reduce((a,b)=>a+b.chapters, 0);   // 260
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
export function indexToBookChapter(list, index){
  let remain = index;
  for (let i=0; i<list.length; i++){
    if (remain < list[i].chapters){
      return { book: list[i].name, chapter: remain+1 };
    }
    remain -= list[i].chapters;
  }
  const last = list[list.length-1];
  return { book: last.name, chapter: last.chapters };
}

// (권, 장) -> index(0-based)
export function bookChapterToIndex(list, bookName, chapter){
  let idx = 0;
  for (let i=0; i<list.length; i++){
    const b = list[i];
    if (b.name === bookName){
      return idx + (chapter-1);
    }
    idx += b.chapters;
  }
  return -1;
}

// (구버전 호환) 시작~끝 label
function makeRangeLabel(list, start, end){
  const s = indexToBookChapter(list, start);
  const e = indexToBookChapter(list, end);
  const count = end - start + 1;
  return `${s.book} ${s.chapter}장 ~ ${e.book} ${e.chapter}장 (총 ${count}장)`;
}

// 날짜 수만큼 totalChapters 균등 분배
function divideChapters(totalChapters, days){
  const base = Math.floor(totalChapters / days);
  let remain = totalChapters % days;
  const arr = [];
  for(let i=0; i<days; i++){
    arr.push(base + (remain>0 ? 1 : 0));
    if (remain>0) remain--;
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
  '창세기','출애굽기','레위기','민수기','신명기',
  '여호수아','사사기','룻기','사무엘상','사무엘하','열왕기상','열왕기하',
  '이사야','예레미야','예레미야애가'
];

// 구약 초급반 B (2달차) — 에스더 다음에 시가서(욥/시/전/아가) 후 에스겔 이후
const OT_B_ORDER_EXCEPT_PROVERBS = [
  '역대상','역대하',
  '에스라','느헤미야','에스더',
  '욥기','시편','전도서','아가',
  '에스겔','다니엘',
  '호세아','요엘','아모스','오바댜','요나','미가','나훔','하박국','스바냐','학개','스가랴','말라기'
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

/**
 * 반 이름과 날짜 리스트에 따라 성경 분량을 계산한다.
 * 반환:
 *  - date
 *  - items: [{book, chapter}, ...]
 *  - label: 표시 문자열
 *  - chapters: 장수
 */
export function getDailyBiblePortionByCrew(crewKey, dateList){
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
