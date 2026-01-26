import React, { useEffect, useState } from 'react';
import useBibleBookmark from '../hooks/useBibleBookmark';
import { useLocation, useNavigate } from 'react-router-dom';
import { getMonthDates } from '../utils/dateUtils';
import { getDailyBiblePortionByCrew } from '../utils/bibleUtils';
import { db } from '../firebase';
import { ref, update } from 'firebase/database';

function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

export default function BibleReadingPage({ user }) {
  const query = useQuery();
  const navigate = useNavigate();
  const uid = user && user.uid ? user.uid : null;
  const { bookmark, loading: bookmarkLoading, saveBookmark } = useBibleBookmark(uid);
  const [bookmarkSaved, setBookmarkSaved] = useState(false);

  const crew = query.get('crew') || '고급반';
  const date = query.get('date');

  // ✅ '달리는 중..' 상태를 위해: 성경 읽기 페이지 진입 시 dailyActivity 기록
  // - RTDB 경로: users/{uid}/dailyActivity/{YYYY-MM-DD}/biblePageVisited = true
  // - 기준 날짜는 URL의 date 파라미터(일일 분량 날짜). 일반적으로 '오늘'을 열게 됨.
  useEffect(() => {
    if (!uid) return;
    if (!date) return;
    // date 형식이 깨져 있으면 기록하지 않음
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const path = ref(db, `users/${uid}/dailyActivity/${date}`);
    update(path, {
      biblePageVisited: true,
      visitedAt: Date.now(),
    }).catch((e) => {
      // rules 또는 네트워크 문제 등으로 실패할 수 있으나, 페이지 자체는 계속 열리도록 한다.
      console.error('[dailyActivity] failed to mark biblePageVisited', e);
    });
  }, [uid, date]);

  const [portion, setPortion] = useState(null);
  const [bible, setBible] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem("bibleFont");
    return saved ? parseInt(saved) : 18;
  });
  const [error, setError] = useState('');

  const [currentPos, setCurrentPos] = useState({ book: null, chapter: null });
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    localStorage.setItem("bibleFont", fontSize);
  }, [fontSize]);

  useEffect(() => {
    async function init() {
      try {
        if (!date) {
          setError('날짜 정보가 없습니다.');
          setLoading(false);
          return;
        }
        const baseDate = new Date(date + 'T00:00:00');
        if (isNaN(baseDate.getTime())) {
          setError('날짜 형식이 올바르지 않습니다.');
          setLoading(false);
          return;
        }
        const year = baseDate.getFullYear();
        const month = baseDate.getMonth() + 1;
        const dates = getMonthDates(year, month);
        const portions = getDailyBiblePortionByCrew(crew, dates);
        const p = portions.find((it) => it.date === date);
        if (!p) {
          setError('해당 날짜의 성경 분량을 찾을 수 없습니다.');
          setLoading(false);
          return;
        }
        const res = await fetch('/bible_kor.json');
        if (!res.ok) {
          throw new Error('성경 데이터를 불러오지 못했습니다.');
        }
        const data = await res.json();
        setBible(data);
        setPortion(p);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError('성경을 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
      }
    }
    init();
  }, [crew, date]);


  const getTopVisibleChapter = () => {
    const chapterElements = document.querySelectorAll("[id^='pos-']");
    if (!chapterElements || chapterElements.length === 0) return null;

    let topElement = null;
    let topDistance = Infinity;

    chapterElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      // 화면 위로 완전히 올라간 요소는 제외
      if (rect.bottom <= 0) return;
      const distance = Math.abs(rect.top - 80); // 상단 여백(헤더) 보정
      if (distance < topDistance) {
        topDistance = distance;
        topElement = el;
      }
    });

    if (!topElement) return null;

    const parts = topElement.id.replace("pos-", "").split("-");
    return { book: parts[0], chapter: parseInt(parts[1], 10) };
  };

  const handleSaveBookmark = async () => {
    if (!uid) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!portion) {
      alert('분량 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const topPos = getTopVisibleChapter();
    if (!topPos || !topPos.book || !topPos.chapter) {
      alert('현재 화면의 성경 장 위치를 확인할 수 없습니다.');
      return;
    }

    await saveBookmark({ bookId: topPos.book, chapter: topPos.chapter });
    setBookmarkSaved(true);
    setTimeout(() => setBookmarkSaved(false), 1500);
  };

  const handleGoToBookmark = () => {
    if (!bookmark || !bookmark.bookId || !bookmark.chapter) return;
    const el = document.getElementById(`pos-${bookmark.bookId}-${bookmark.chapter}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      alert('저장된 책갈피 위치를 찾을 수 없습니다.');
    }
  };

  // 성경 데이터의 본문 중복 오류 해결 (greedy 매칭으로 인한 오삭제 방지)
  const cleanVerseText = (text) => {
    if (!text) return "";
    // 성경 66권 약어 목록 (가장 긴 것부터 정렬하여 매칭 오류 방지)
    const abbrevs = [
      "사무엘상", "사무엘하", "열왕기상", "열왕기하", "역대상", "역대하", "예레미야애가", "데살로니가전서", "데살로니가후서", "디모데전서", "디모데후서", "베드로전서", "베드로후서", "요한일서", "요한이서", "요한삼서", "고린도전서", "고린도후서",
      "삼상", "삼하", "왕상", "왕하", "대상", "대하", "살전", "살후", "딤전", "딤후", "딛전", "딛후", "벧전", "벧후", "요일", "요이", "요삼", "고전", "고후",
      "창", "출", "레", "민", "신", "수", "삿", "룻", "에", "욥", "시", "잠", "전", "아", "사", "렘", "애", "겔", "단", "호", "욜", "암", "옵", "욘", "미", "나", "합", "습", "학", "슥", "말", "마", "막", "눅", "요", "행", "롬", "갈", "엡", "빌", "골", "딛", "몬", "히", "약", "유", "계"
    ];

    // 패턴: 약어 + 숫자 + : + 숫자
    const pattern = new RegExp("(" + abbrevs.join("|") + ")\\d+:\\d+");
    const match = text.match(pattern);

    if (match) {
      const idx = text.indexOf(match[0]);
      // 본문 뒤에 붙은 경우(보통 뒷부분)에만 동작
      if (idx > 10) {
        return text.substring(0, idx).trim();
      }
    }
    return text;
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', padding: 20, background: '#E5FFF5' }}>
        <h2 style={{ marginTop: 0 }}>📖 성경 읽기</h2>
        <p>데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (error || !portion || !bible) {
    return (
      <div style={{ minHeight: '100vh', padding: 20, background: '#E5FFF5' }}>
        <h2 style={{ marginTop: 0 }}>📖 성경 읽기</h2>
        <p style={{ color: '#b91c1c' }}>{error || '데이터를 불러올 수 없습니다.'}</p>
        <button
          onClick={() => navigate(-1)}
          style={{
            marginTop: 16,
            padding: '8px 16px',
            borderRadius: 999,
            border: 'none',
            background: '#2563EB',
            color: '#0f172a',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ← 돌아가기
        </button>
      </div>
    );
  }

  // v08: 일일 분량은 {items:[{book,chapter}]} 형태
  const uniqueKeys = [];
  (portion.items || []).forEach((it) => {
    if (!it?.book || !it?.chapter) return;
    const key = `${it.book}:${it.chapter}`;
    if (!uniqueKeys.includes(key)) uniqueKeys.push(key);
  });

  const chapterGroups = uniqueKeys.map((key) => {
    const [book, chapterStr] = key.split(':');
    const chapterNum = parseInt(chapterStr, 10);
    const chapterData = bible?.[book]?.[String(chapterNum)];
    return { book, chapter: chapterNum, verses: chapterData || {} };
  });

  // 파노라마 섹션 그룹 생성
  const panoramaSections = portion.panorama ? portion.panorama.parsedSections.map(sec => {
    return {
      ...sec,
      chapters: sec.items.map(it => {
        const chapterData = bible?.[it.book]?.[String(it.chapter)];
        return { book: it.book, chapter: it.chapter, verses: chapterData || {} };
      })
    };
  }) : null;

  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Apple SD Gothic Neo", system-ui',
        background: darkMode ? '#050509' : '#f2f2f7',
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          maxWidth: 820,
          margin: '0 auto',
          minHeight: '100vh',
          padding: '12px 12px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* iOS 스타일 상단 네비게이션 바 */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            padding: '8px 4px 10px',
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            background: darkMode
              ? 'rgba(15,23,42,0.9)'
              : 'rgba(242,242,247,0.9)',
            borderBottom: darkMode
              ? '1px solid rgba(15,23,42,0.9)'
              : '1px solid rgba(226,232,240,0.9)',
          }}
        >
          {/* 뒤로가기 버튼 */}
          <button
            onClick={() => navigate(-1)}
            style={{
              width: 54,
              padding: '6px 8px',
              borderRadius: 14,
              border: 'none',
              background: darkMode ? 'rgba(15,23,42,0.8)' : '#ffffff',
              boxShadow: darkMode
                ? '0 4px 10px rgba(0,0,0,0.45)'
                : '0 4px 10px rgba(148,163,184,0.55)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0,
              fontSize: 18,
              cursor: 'pointer',
              color: darkMode ? '#E5E7EB' : '#111827',
            }}
          >
            ←
          </button>

          {/* 제목 / 오늘 분량 */}
          {/* 다크모드 토글 아이콘 */}
          <button
            onClick={() => setDarkMode((prev) => !prev)}
            aria-label={darkMode ? '라이트 모드로 전환' : '다크모드로 전환'}
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              border: '1px solid',
              borderColor: darkMode ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.12)',
              background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
              color: darkMode ? '#E5E7EB' : '#111827',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{darkMode ? '☀️' : '🌙'}</span>
            <span style={{ whiteSpace: 'nowrap', lineHeight: 1.2, letterSpacing: '0.01em' }}>{darkMode ? '라이트 모드' : '다크모드'}</span>
          </button>
        </div>

        {/* 상단 정보 카드 (책갈피 + 폰트 조절 + 날짜) */}
        <div
          style={{
            borderRadius: 18,
            padding: 14,
            color: darkMode ? '#E5E7EB' : '#0f172a',
            background: darkMode
              ? 'rgba(15,23,42,0.95)'
              : 'rgba(255,255,255,0.96)',
            boxShadow: darkMode
              ? '0 10px 25px rgba(0,0,0,0.7)'
              : '0 8px 22px rgba(148,163,184,0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* 🔖 상단 책갈피 안내 바 */}
          {!bookmarkLoading && (
            <div
              style={{
                padding: '9px 11px',
                borderRadius: 12,
                color: darkMode ? '#E5E7EB' : '#0f172a',
                background: darkMode
                  ? 'rgba(15,23,42,0.9)'
                  : 'rgba(248,250,252,0.95)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 13,
                gap: 8,
              }}
            >
              <span>
                {bookmark
                  ? `📌 지난 책갈피: ${bookmark.bookId} ${bookmark.chapter}장`
                  : '📌 저장된 책갈피가 없습니다.'}
              </span>
              {bookmark && (
                <button
                  onClick={handleGoToBookmark}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: 'none',
                    background: '#4a6cf7',
                    color: '#F9FAFB',
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  이어 읽기
                </button>
              )}
            </div>
          )}

          {/* 폰트 / 모드 / 날짜 영역 */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setFontSize((f) => Math.max(14, f - 2))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 10,
                    border: 'none',
                    background: darkMode ? '#020617' : '#E5E7EB',
                    color: darkMode ? '#E5E7EB' : '#111827',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  A-
                </button>
                <button
                  onClick={() => setFontSize((f) => Math.min(26, f + 2))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 10,
                    border: 'none',
                    background: darkMode ? '#020617' : '#E5E7EB',
                    color: darkMode ? '#E5E7EB' : '#111827',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  A+
                </button>
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>날짜: {date}</div>
            </div>
            {portion.panorama ? (
              <div style={{ marginTop: 8 }}>
                <div style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: '#1F8A70',
                  letterSpacing: '-0.02em',
                  marginBottom: 8
                }}>
                  {portion.panorama.mainTitle}
                </div>
                <div style={{
                  fontSize: 16,
                  fontWeight: 600,
                  opacity: 0.9,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px 10px'
                }}>
                  {portion.panorama.sections.map((s, idx) => (
                    <span key={idx} style={{
                      background: darkMode ? 'rgba(31,138,112,0.25)' : '#E5F3E6',
                      color: darkMode ? '#86EFAC' : '#1F8A70',
                      padding: '4px 10px',
                      borderRadius: 10,
                      border: darkMode ? '1px solid rgba(134,239,172,0.2)' : 'none'
                    }}>
                      {s.subTitle} ({s.bibleRef})
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div
                style={{
                  marginTop: 12,
                  fontSize: Math.max(22, fontSize + 4),
                  letterSpacing: '0.01em', fontWeight: 800,
                }}
              >
                {crew} · {portion.label}
              </div>
            )}
          </div>
        </div>

        {/* 성경 본문 영역 */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            background: darkMode
              ? 'rgba(15,23,42,0.98)'
              : '#ffffff',
            color: darkMode ? '#E5E7EB' : '#0f172a',
            borderRadius: 22,
            padding: 18,
            boxShadow: darkMode
              ? '0 16px 40px rgba(0,0,0,0.8)'
              : '0 16px 40px rgba(148,163,184,0.45)',
          }}
        >
          {panoramaSections ? (
            panoramaSections.map((sec, sIdx) => (
              <div key={sIdx} style={{ marginBottom: 40 }}>
                {/* 섹션 서브타이틀 표시 */}
                <div style={{
                  padding: '8px 12px',
                  background: darkMode ? 'rgba(31,138,112,0.2)' : '#E5F3E6',
                  borderRadius: 12,
                  marginBottom: 16,
                  borderLeft: '4px solid #1F8A70'
                }}>
                  <div style={{ fontSize: 13, color: '#1F8A70', fontWeight: 700, marginBottom: 2 }}>SECTION {sIdx + 1}</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{sec.subTitle} ({sec.bibleRef})</div>
                </div>

                {sec.chapters.map((group) => (
                  <div
                    key={group.book + group.chapter}
                    id={`pos-${group.book}-${group.chapter}`}
                    style={{ marginBottom: 22 }}
                  >
                    <h3
                      style={{
                        margin: '0 0 10px',
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                    >
                      {group.book} {group.chapter}장
                    </h3>
                    {Object.keys(group.verses).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).map((vno) => {
                      const raw = group.verses[vno] || '';
                      const m = raw.match(/^<([^>]+)>\s*(.*)$/);
                      const title = m ? m[1] : null;
                      const body = m ? m[2] : raw;
                      return (
                        <div key={vno} style={{ margin: '6px 0' }}>
                          {title && (
                            <div style={{ color: '#1F8A70', fontWeight: 700, fontSize: '1.05em', marginBottom: 4 }}>
                              [ {title} ]
                            </div>
                          )}
                          <p style={{ margin: '2px 0', fontSize: fontSize, letterSpacing: '0.01em', lineHeight: 1.65 }}>
                            <strong>{vno}.</strong> {cleanVerseText(body)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))
          ) : (
            chapterGroups.map((group) => {
              const verseNumbers = Object.keys(group.verses).sort(
                (a, b) => parseInt(a, 10) - parseInt(b, 10)
              );
              return (
                <div
                  key={group.book + group.chapter}
                  id={`pos-${group.book}-${group.chapter}`}
                  style={{ marginBottom: 22 }}
                  onMouseEnter={() =>
                    setCurrentPos({ book: group.book, chapter: group.chapter })
                  }
                >
                  <h3
                    style={{
                      margin: '0 0 10px',
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  >
                    {group.book} {group.chapter}장
                  </h3>
                  {verseNumbers.map((vno) => {
                    const raw = group.verses[vno] || '';
                    const m = raw.match(/^<([^>]+)>\s*(.*)$/);
                    const title = m ? m[1] : null;
                    const body = m ? m[2] : raw;
                    return (
                      <div key={vno} style={{ margin: '6px 0' }}>
                        {title && (
                          <div style={{
                            color: '#1F8A70',
                            fontWeight: 700,
                            fontSize: '1.05em',
                            marginBottom: 4
                          }}>
                            [ {title} ]
                          </div>
                        )}
                        <p style={{
                          margin: '2px 0',
                          fontSize: fontSize,
                          letterSpacing: '0.01em',
                          lineHeight: 1.65
                        }}>
                          <strong>{vno}.</strong> {cleanVerseText(body)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* 하단 여백 (iOS 느낌 살리기용) */}
        <div style={{ height: 40 }} />

        {/* 플로팅 책갈피 버튼 */}
        <button
          onClick={handleSaveBookmark}
          style={{
            position: 'fixed',
            right: 20,
            bottom: 24,
            zIndex: 9999,
            padding: '10px 16px',
            borderRadius: 999,
            border: 'none',
            background: 'rgba(255,255,255,0.9)',
            color: '#0f172a',
            fontWeight: 'bold',
            fontSize: 14,
            boxShadow: '0 14px 30px rgba(15,23,42,0.35)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 18 }}>📌</span>
          <span>책갈피 저장</span>
        </button>

        {/* iOS 스타일 책갈피 저장 토스트 */}
        {bookmarkSaved && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.25)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            <div
              style={{
                width: '85%',
                maxWidth: 340,
                padding: '16px 18px',
                borderRadius: 28,
                background: 'rgba(255,255,255,0.85)',
                color: '#0f172a',
                boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  margin: '0 auto 10px',
                  borderRadius: 24,
                  background: '#34C759',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  color: '#fff',
                }}
              >
                ✓
              </div>
              <div
                style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}
              >
                책갈피 저장됨
              </div>
              <div style={{ fontSize: 13, color: '#475569' }}>
                다음에 이 위치부터 계속 읽을 수 있어요
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}