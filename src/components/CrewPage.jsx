import React, { useEffect, useState } from 'react';
import useSettings from '../hooks/useSettings';
import { useNavigate } from 'react-router-dom';
import { subscribeToCrewChecks, saveCrewCheck, addComment, updateComment, deleteComment, subscribeToCrewComments, getCurrentYMKey, subscribeToUserApproval, subscribeToAllCrewChecks, subscribeToUsers, clearUserCrew, getClassNotice, getUserSeenNoticeVersion, markNoticeSeen } from '../firebaseSync';
import { getMonthDates } from '../utils/dateUtils';
import { getDailyBiblePortionByCrew, OT_TOTAL, NT_TOTAL, ALL_TOTAL, OT_A_TOTAL, OT_B_TOTAL } from '../utils/bibleUtils';
import { getCrewLabel } from '../utils/crewConfig';
import { getTodayCrewState } from '../utils/crewStatusUtils';

export default function CrewPage({ crewName, user }) {
  const displayName = `${getCrewLabel(crewName)} 성경크루`;
  const [checks, setChecks] = useState({});
  const [current, setCurrent] = useState(new Date());
  const [allComments, setAllComments] = useState([]);
  const [showMoreComments, setShowMoreComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [approvalLoaded, setApprovalLoaded] = useState(false);
  const [classNotice, setClassNotice] = useState(null);
  const [showClassNotice, setShowClassNotice] = useState(false);
  const [crewStatus, setCrewStatus] = useState([]);
  const [allCrews, setAllCrews] = useState({});
  const [usersMap, setUsersMap] = useState({});
  const [showCrewStatus, setShowCrewStatus] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const settings = useSettings();
  const approvalModes = (settings && settings.approval) || {};
  const approvalModeForCrew = approvalModes[crewName] || 'manual';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 768px)');
    const handleResize = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', handleResize);
    return () => mql.removeEventListener('change', handleResize);
  }, []);

  const navigate = useNavigate();
  const ymKey = getCurrentYMKey();

  function formatDateTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${m}-${day} ${hh}:${mm}`;
  }

  let totalChapters = ALL_TOTAL;
  if (crewName === '중급반') totalChapters = OT_TOTAL;
  else if (crewName === '초급반') totalChapters = NT_TOTAL;
  else if (crewName === '초급반(구약A)') totalChapters = OT_A_TOTAL;
  else if (crewName === '초급반(구약B)') totalChapters = OT_B_TOTAL;


  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToUserApproval(crewName, ymKey, user.uid, (ok) => {
      setIsApproved(ok);
      setApprovalLoaded(true);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [user, crewName, ymKey]);

  // ✅ 반(초/중/고) 안내 팝업: 반 입장 시(승인 완료 후) 1회 노출(버전 기반)
  useEffect(() => {
    if (!user?.uid) return;
    if (!crewName) return;
    if (!approvalLoaded) return;
    const canEnter = approvalModeForCrew !== 'manual' || isApproved;
    if (!canEnter) {
      setShowClassNotice(false);
      return;
    }

    let alive = true;
    (async () => {
      try {
        const notice = await getClassNotice(crewName);
        if (!alive) return;
        if (!notice || !notice.enabled) {
          setShowClassNotice(false);
          return;
        }
        const version = parseInt(notice.version || '0', 10) || 0;
        const seenV = await getUserSeenNoticeVersion(user.uid, crewName);
        if (!alive) return;
        const hasContent = !!((notice.title || '').trim() || (notice.content || '').trim());
        if (hasContent && version > (seenV || 0)) {
          setClassNotice({ ...notice, version });
          setShowClassNotice(true);
        } else {
          setShowClassNotice(false);
        }
      } catch (e) {
        console.error('반 안내 팝업 로드 오류', e);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.uid, crewName, approvalLoaded, isApproved, approvalModeForCrew]);

  async function closeClassNotice() {
    try {
      if (user?.uid && crewName && classNotice?.version) {
        await markNoticeSeen(user.uid, crewName, classNotice.version);
      }
    } catch (e) {
      console.error('반 안내 팝업 확인 기록 저장 오류', e);
    } finally {
      setShowClassNotice(false);
    }
  }

  // ✅ 승인 취소/미션 종료 등으로 더 이상 승인되지 않은 경우: 사용자 crew 정보 자동 해제
  useEffect(() => {
    if (!user?.uid) return;
    if (!approvalLoaded) return;
    if (isApproved) return;
    // 사용자가 현재 이 반으로 기록되어 있다면, 미배정 상태로 되돌림
    if (user.crew === crewName) {
      clearUserCrew(user.uid).catch((e) => console.error('crew 해제 오류', e));
    }
  }, [user, crewName, approvalLoaded, isApproved]);

  useEffect(() => {
    if (!user?.uid) return;
    if (!approvalLoaded || !isApproved) {
      setChecks({});
      return;
    }
    const unsub = subscribeToCrewChecks(crewName, user.uid, setChecks);
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [user, crewName, approvalLoaded, isApproved]);


  // 우리 크루 전체 달리기 현황 계산 (참여자들이 함께 보는 용도)
  useEffect(() => {
    const unsubUsers = subscribeToUsers((u) => setUsersMap(u || {}));
    const unsubCrews = subscribeToAllCrewChecks((c) => setAllCrews(c || {}));
    return () => {
      if (typeof unsubUsers === 'function') unsubUsers();
      if (typeof unsubCrews === 'function') unsubCrews();
    };
  }, []);

  useEffect(() => {
    if (!crewName) {
      setCrewStatus([]);
      return;
    }
    const crews = allCrews || {};
    const users = usersMap || {};
    const crewNode = crews[crewName];
    const usersNode = (crewNode && crewNode.users) || {};

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const dates = getMonthDates(year, month);
    if (!dates || dates.length === 0) {
      setCrewStatus([]);
      return;
    }
    const today = now.getDate();
    const uptoDates = dates.slice(0, today);

    const todayKey = `${year}-${String(month).padStart(2, '0')}-${String(today).padStart(2, '0')}`;

    const portions = getDailyBiblePortionByCrew(crewName, dates);
    const portionMap = {};
    (portions || []).forEach((p) => {
      if (!p || !p.date) return;
      portionMap[p.date] = p.chapters || 0;
    });

    // ✅ 관리자 모드의 "이번 달 크루 현황" 로직을 그대로 따라가되, 현재 반(crewName)만 계산
    // - 핵심: users/{uid}/crew 값에 의존하지 않고, crews/{crewName}/users 아래에 존재하는 참여자 기준으로 집계
    // - 이유: 월별 승인/참여 구조상 user.crew 문자열이 비어있거나 갱신되지 않아도, crews 노드는 정상적으로 존재할 수 있음
    const list = [];

    Object.entries(usersNode).forEach(([uid, u]) => {
      const userChecks = (u && u.checks) || {};
      let readChapters = 0;
      let requiredChapters = 0;
      let allCovered = true;

      uptoDates.forEach((d) => {
        const ch = portionMap[d] || 0;
        if (!ch) return;
        requiredChapters += ch;
        if (userChecks[d]) {
          readChapters += ch;
        } else {
          allCovered = false;
        }
      });

      // 분량 계산이 불가능하면 제외
      if (requiredChapters === 0) return;

      const info = users && users[uid] ? users[uid] : {};
      const name = info.name || uid;
      const medals = info.medals || {};
      const progress = Math.round((readChapters / requiredChapters) * 100);
      const state = getTodayCrewState({
        dates,
        todayKey,
        userChecks,
        userDailyActivity: info.dailyActivity || {},
      });

      list.push({
        uid,
        name,
        chapters: readChapters,
        progress,
        stateKey: state.key,
        stateLabel: state.label,
        medals,
      });
    });

    list.sort((a, b) => (b.chapters || 0) - (a.chapters || 0));
    setCrewStatus(list);
  }, [crewName, allCrews, usersMap]);

  useEffect(() => {
    // 반별 소감 실시간 구독
    const unsub = subscribeToCrewComments(crewName, setAllComments);
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [crewName]);

  // 반 페이지: 기본은 최신 20개, 더보기는 '최근 3일'만 출력
  const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
  const cutoff3d = Date.now() - THREE_DAYS;
  const baseComments = (allComments || []).slice(0, 20);
  const recent3dComments = (allComments || []).filter((c) => (c.timestamp || 0) >= cutoff3d);
  const visibleComments = showMoreComments ? recent3dComments : baseComments;

  if (!user || !user.uid) {
    return (
      <div style={{ padding:20, background:'#F8F9FF', minHeight:'100vh' }}>
        <h2 style={{ color: '#034732', fontSize: 32, fontWeight: 800, textAlign: 'center' }}>🏃 {displayName}</h2>
        <p>먼저 로그인 후 이용해 주세요.</p>
      </div>
    );
  }

  if (approvalModeForCrew === 'manual' && !isApproved) {
    return (
      <div style={{ padding:20, background:'#F8F9FF', minHeight:'100vh' }}>
        <h2 style={{ color: '#034732', fontSize: 32, fontWeight: 800, textAlign: 'center' }}>
          {crewName} 성경크루
        </h2>
        <p style={{ textAlign:'center', marginTop:20, fontSize:16 }}>
          관리자 승인 후 입장하실 수 있습니다.
        </p>
      </div>
    );
  }


  if (!approvalLoaded) {
    return (
      <div style={{ padding:20, background:'#F8F9FF', minHeight:'100vh' }}>
        <h2 style={{ color: '#034732', fontSize: 32, fontWeight: 800, textAlign: 'center' }}>🏃 {displayName}</h2>
        <p>승인 여부를 확인하는 중입니다...</p>
      </div>
    );
  }

  if (approvalModeForCrew === 'manual' && !isApproved) {
    return (
      <div style={{ padding:20, background:'#F8F9FF', minHeight:'100vh' }}>
        <h2 style={{ color: '#034732', fontSize: 32, fontWeight: 800, textAlign: 'center' }}>
          {crewName} 성경크루
        </h2>
        <p style={{ textAlign:'center', marginTop:20, fontSize:16 }}>
          관리자 승인 후 입장하실 수 있습니다.
        </p>
      </div>
    );
  }


  if (approvalModeForCrew === 'closed') {
    return (
      <div style={{ padding:20, background:'#F8F9FF', minHeight:'100vh' }}>
        <h2 style={{ color: '#034732', fontSize: 32, fontWeight: 800, textAlign: 'center' }}>🏃 {displayName}</h2>
        <p>이번 달에는 이 반에 승인되지 않았습니다. 관리자에게 문의해 주세요.</p>
        <button
          onClick={() => navigate('/home')}
          style={{
            marginTop: 20,
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: '#1565C0',
            color: '#fff',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          ← 홈으로
        </button>
      </div>
    );
  }

  if (approvalModeForCrew === 'manual' && !isApproved) {
    return (
      <div style={{ padding:20, background:'#F8F9FF', minHeight:'100vh' }}>
        <h2 style={{ color: '#034732', fontSize: 32, fontWeight: 800, textAlign: 'center' }}>
          {crewName} 성경크루
        </h2>
        <p style={{ textAlign:'center', marginTop:20, fontSize:16 }}>
          관리자 승인 후 입장하실 수 있습니다.
        </p>
      </div>
    );
  }


  const year = current.getFullYear();
  const month = current.getMonth() + 1;

  const dates = getMonthDates(year, month);
  const portions = getDailyBiblePortionByCrew(crewName, dates);

  const todayKey = `${year}-${String(month).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`;
  const yearShort = String(year).slice(2);
  const formattedDate = `${yearShort}년 ${String(month).padStart(2,'0')}월 ${String(current.getDate())}일`;
  const todayPortion = portions.find((p) => p.date === todayKey);

  // 날짜별 분량(장수) 맵 생성
  const portionMap = {};
  portions.forEach((p) => {
    portionMap[p.date] = p.chapters || 0;
  });

  // 이번 달에 실제로 읽은 장수 계산 (체크된 날짜 기준)
  let monthChapters = 0;
  dates.forEach((d) => {
    if (checks[d]) {
      monthChapters += portionMap[d] || 0;
    }
  });

  const monthKm = (monthChapters / 10).toFixed(1); // 10장 = 1km
  const progress = Math.min(100, Math.round((monthChapters / totalChapters) * 100) || 0);
  let startLabel = todayPortion && (todayPortion.startLabel || '');
  let endLabel = todayPortion && (todayPortion.endLabel || '');
  let todayChapters = 0;

  if (todayPortion) {
    todayChapters = todayPortion.chapters || todayPortion.chapterCount || 0;
  }

  if ((!startLabel || !endLabel) && todayPortion && todayPortion.label) {
    const parts = String(todayPortion.label).split('~');
    if (parts.length === 2) {
      startLabel = parts[0].trim();
      endLabel = parts[1].trim();
    } else {
      startLabel = todayPortion.label;
      endLabel = '';
    }

  // '성경 러닝 코스(총 n장)' 제목과 범위 텍스트에서 '총 n장'이 중복되지 않도록
  const stripTotalLabel = (label) =>
    label ? label.replace(/\(총\s*\d+장\)\s*$/, '').trim() : '';

  startLabel = stripTotalLabel(startLabel);
  endLabel = stripTotalLabel(endLabel);
  }

  function toggle(d) {
    if (!isApproved) return;
    saveCrewCheck(crewName, user.uid, d, !(checks[d] ?? false));
  }

  function moveDate(diff) {
    const newDay = new Date(current);
    newDay.setDate(newDay.getDate() + diff);
    setCurrent(newDay);
  }

  function handleAddComment() {
    const text = commentText.trim();
    if (!text) return;
    const payload = {
      text,
      user: user.name || '익명',
      // ✅ 작성자 식별자(본인 글 수정/삭제 표시용)
      uid: user.uid,
      timestamp: Date.now()
    };
    addComment(crewName, payload).then(() => {
      setCommentText('');
    });
  }

  function handleStartEditComment(c) {
    if (!c || c.uid !== user.uid) return;
    setEditingCommentId(c.id);
    setEditingCommentText(c.text || '');
  }

  async function handleSaveEditComment(c) {
    if (!c || c.uid !== user.uid) return;
    const next = (editingCommentText || '').trim();
    if (!next) {
      alert('내용을 입력해 주세요.');
      return;
    }
    try {
      setCommentBusy(true);
      await updateComment(crewName, c.id, { text: next, editedAt: Date.now() });
      setEditingCommentId(null);
      setEditingCommentText('');
    } catch (e) {
      console.error(e);
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      setCommentBusy(false);
    }
  }

  async function handleDeleteMyComment(c) {
    if (!c || c.uid !== user.uid) return;
    const ok = window.confirm('이 소감을 삭제하면 복구할 수 없습니다. 삭제하시겠습니까?');
    if (!ok) return;
    try {
      setCommentBusy(true);
      await deleteComment(crewName, c.id);
    } catch (e) {
      console.error(e);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setCommentBusy(false);
    }
  }



return (
    <div
      style={{
        minHeight: '100vh',
        padding: isMobile ? '20px 16px 32px' : '24px 30px 40px',
        background: '#E5F3E6',
        /* color handled per-text */
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {/* ✅ 반 안내 팝업 (터치하면 닫힘) */}
      {showClassNotice && classNotice && (
        <div
          onClick={closeClassNotice}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? 18 : 24,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#FFFFFF',
              borderRadius: 18,
              boxShadow: '0 18px 40px rgba(0,0,0,0.22)',
              padding: isMobile ? '18px 18px 16px' : '22px 22px 18px',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>
                {(classNotice.title || `${crewName} 안내`).toString()}
              </div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>터치하면 닫혀요</div>
            </div>
            <div
              style={{
                marginTop: 14,
                fontSize: 15,
                lineHeight: 1.7,
                color: '#111827',
                whiteSpace: 'pre-wrap',
              }}
            >
              {classNotice.content}
            </div>
          </div>
        </div>
      )}

      {/* 상단 제목 */}
      <h2 style={{ color: '#034732', fontSize: 32, fontWeight: 800, textAlign: 'center' }}>
        {displayName}
      </h2>

      {/* 상단 진행률 영역 */}
      <div
        style={{
          marginTop: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        {/* 진행률 도넛 (SVG) */}
        <svg width={120} height={120}>
          <circle
            stroke="#E5E7EB"
            fill="transparent"
            strokeWidth={14}
            r={50}
            cx={60}
            cy={60}
          />
          <circle
            stroke="#6366F1"
            fill="transparent"
            strokeWidth={14}
            strokeLinecap="round"
            r={50}
            cx={60}
            cy={60}
            strokeDasharray={2 * Math.PI * 50}
            strokeDashoffset={2 * Math.PI * 50 - (progress / 100) * (2 * Math.PI * 50)}
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
        </svg>

        {/* 진행률 텍스트 */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: 15, color: '#4B5563' }}>이번달 누적 진행률</p>
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 28, fontWeight: 700 }}>{progress}%</span>
            <span style={{ fontSize: 20, fontWeight: 600 }}>{monthKm}km</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 16, color: '#4B5563' }}>
            ({monthChapters}장 / {totalChapters}장)
          </div>
        </div>
      </div>

      {/* 오늘 러닝 코스 (네비 + 오늘 분량 박스) */}
      <div
        style={{
          marginTop: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        {/* 왼쪽 화살표 */}
        <button
          onClick={() => moveDate(-1)}
          style={{
            width: 45,
            height: 45,
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderLeft: '10px solid #122654',
              borderBottom: '10px solid #122654',
              transform: 'rotate(45deg)',
              borderRadius: 5,
            }}
          />
        </button>

        {/* 오늘 분량 박스 */}
        <div
          onClick={() => toggle(todayKey)}
          style={{
            flex: 1.3,
            maxWidth: isMobile ? '100%' : 480,
            background: checks[todayKey] ? '#1B9C5A' : '#D5D5D5',
            borderRadius: 34,
            padding: isMobile ? '20px 18px 32px' : '24px 30px 40px',
            color: '#111827',
            textAlign: 'center',
            boxShadow: '0 12px 22px rgba(0,0,0,0.12)',
            cursor: isApproved ? 'pointer' : 'not-allowed',
            opacity: isApproved ? 1 : 0.6,
            position: 'relative',
            minHeight: isMobile ? 260 : 220,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* 날짜 */}
          <div style={{ fontSize: 24, fontWeight: 800, color: checks[todayKey] ? '#E5F3E6' : '#034732' }}>
            {formattedDate}
          </div>

          {/* 성경 러닝코스 (오늘 읽을 장수) */}
          <div style={{ marginTop: 4, fontSize: isMobile ? 20 : 22, fontWeight: 700, color: checks[todayKey] ? '#E5F3E6' : '#034732' }}>
            성경 러닝 코스(총 {todayChapters}장)
          </div>

          {/* 오늘 범위 */}
          {/* 오늘 범위 */}
          {todayPortion && Array.isArray(todayPortion.items) && todayPortion.items.length > 0 && (
            <div style={{ marginTop: 16, fontSize: isMobile ? 18 : 20, fontWeight: 600, lineHeight: 1.5, color: checks[todayKey] ? '#E5F3E6' : '#034732', textAlign: 'left' }}>
              {(() => {
                const items = todayPortion.items || [];
                const ranges = [];
                for (const it of items) {
                  if (!it || !it.book || typeof it.chapter !== 'number') continue;
                  const last = ranges[ranges.length - 1];
                  if (last && last.book === it.book && it.chapter === last.to + 1) {
                    last.to = it.chapter;
                  } else {
                    ranges.push({ book: it.book, from: it.chapter, to: it.chapter });
                  }
                }
                return ranges.map((r) => (
                  <div key={`${r.book}-${r.from}-${r.to}`} style={{ whiteSpace: 'nowrap' }}>
                    {r.from === r.to ? `${r.book} ${r.from}장` : `${r.book} ${r.from}장~${r.to}장`}
                  </div>
                ));
              })()}
            </div>
          )}

          {/* 체크 박스 (왼쪽 아래) */}
          <div
            style={{
              position: 'absolute',
              left: 18,
              bottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                border: '3px solid #0F3455',
                background: checks[todayKey] ? '#22C55E' : '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {checks[todayKey] && (
                <span style={{ fontSize: 22, color: '#064E3B' }}>✓</span>
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽 화살표 */}
        <button
          onClick={() => moveDate(1)}
          style={{
            width: 45,
            height: 45,
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRight: '10px solid #122654',
              borderBottom: '10px solid #122654',
              transform: 'rotate(-45deg)',
              borderRadius: 5,
            }}
          />
        </button>
      </div>

      {/* 안내 문구 */}
      <div
        style={{
          marginTop: 10,
          textAlign: 'center',
          fontSize: 15,
          fontWeight: 500,
          color: '#555',
        }}
      >
        오늘 분량을 읽고 체크하세요
      </div>

      {/* 오늘의 성경읽기 안내 문구 (박스 밖) */}
      <div
        style={{
          marginTop: 14,
          fontSize: 15,
          lineHeight: 1.5,
          fontWeight: 500,
          textAlign: 'center',
          color: '#555',
        }}
      >
        버튼을 누르면 오늘의 성경읽기 페이지로 이동합니다.<br /> 책갈피 기능으로 이어읽기 가능
      </div>

      {/* 오늘의 성경읽기 안내 박스 */}
      <div
        style={{
          marginTop: 12,
          background: '#FFFFFF',
          borderRadius: 24,
          padding: isMobile ? '6px 8px 8px' : '12px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          maxWidth: 520,
          width: '88%',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {/* 버튼 + 러너 */}
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isMobile ? 8 : 16,
          }}
        >
          <button
            onClick={() =>
              navigate(
                `/성경읽기?crew=${encodeURIComponent(crewName)}&date=${todayKey}`
              )
            }
            style={{
              background: '#F7C948',
              borderRadius: 28,
              padding: isMobile ? '20px 26px' : '22px 32px',
              border: 'none',
              color: '#000',
              fontSize: 19,
              fontWeight: 700,
              lineHeight: 1.35,
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
              minWidth: isMobile ? 130 : 170,
              textAlign: 'center',
            }}
          >
            오늘의
            <br />
            성경읽기
          </button>

          <img
            src="/runner.png"
            alt="runner"
            style={{
              width: isMobile ? 80 : 125,
              height: 'auto',
              objectFit: 'contain',
            }}
          />
        </div>
      </div>
{/* 오늘의 소감 */}
      <div style={{ marginTop: 32 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>오늘의 소감</p>
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          rows={3}
          placeholder="오늘의 소감을 적어 서로를 응원하세요"
          style={{
            width: '100%',
            marginTop: 10,
            padding: 12,
            borderRadius: 12,
            border: '1px solid #CBD5E1',
            fontSize: 14,
            resize: 'vertical',
          }}
        />
        <button
          onClick={handleAddComment}
          style={{
            marginTop: 10,
            padding: '10px 18px',
            border: 'none',
            borderRadius: 10,
            background: '#1B9C5A',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          등록
        </button>
      </div>

      {/* 전체 소감 (기존 UI 유지) */}
      <div style={{ marginTop: 24 }}>
        <p style={{ fontWeight: 700, marginBottom: 8 }}>💬 전체 소감</p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button
            onClick={() => setShowMoreComments((v) => !v)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid #1B9C5A',
              background: showMoreComments ? '#1B9C5A' : '#fff',
              color: showMoreComments ? '#fff' : '#1B9C5A',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            {showMoreComments ? '접기' : '소감 더보기(최근 3일)'}
          </button>
          {showMoreComments && (
            <div style={{ fontSize: 12, color: '#555', alignSelf: 'center' }}>
              최근 3일 이내 소감만 추가로 보여줍니다.
            </div>
          )}
        </div>

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {visibleComments.map((c) => {
            const isMine = c && c.uid && user && c.uid === user.uid;
            const isEditing = editingCommentId === c.id;
            return (
              <li
                key={c.id}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  background: '#F1F5F9',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontWeight: 700 }}>{c.user}</span>
                    {c.timestamp && (
                      <span style={{ fontSize: 12, color: '#6B7280' }}>
                        {formatDateTime(c.timestamp)}
                        {c.editedAt ? ' (수정됨)' : ''}
                      </span>
                    )}
                  </div>

                  {!isEditing ? (
                    <div style={{ marginTop: 4, color: '#374151', wordBreak: 'break-word' }}>
                      {c.text}
                    </div>
                  ) : (
                    <div style={{ marginTop: 6 }}>
                      <textarea
                        value={editingCommentText}
                        onChange={(e) => setEditingCommentText(e.target.value)}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: 10,
                          borderRadius: 10,
                          border: '1px solid #CBD5E1',
                          fontSize: 13,
                          resize: 'vertical',
                          boxSizing: 'border-box',
                          background: '#fff',
                        }}
                        disabled={commentBusy}
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          onClick={() => handleSaveEditComment(c)}
                          disabled={commentBusy}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 10,
                            border: 'none',
                            background: '#1B9C5A',
                            color: '#fff',
                            fontWeight: 700,
                            cursor: 'pointer',
                            opacity: commentBusy ? 0.6 : 1,
                          }}
                        >
                          저장
                        </button>
                        <button
                          onClick={() => {
                            setEditingCommentId(null);
                            setEditingCommentText('');
                          }}
                          disabled={commentBusy}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 10,
                            border: '1px solid #CBD5E1',
                            background: '#fff',
                            color: '#111827',
                            fontWeight: 700,
                            cursor: 'pointer',
                            opacity: commentBusy ? 0.6 : 1,
                          }}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {isMine && !isEditing && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleStartEditComment(c)}
                      disabled={commentBusy}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 10,
                        border: '1px solid #CBD5E1',
                        background: '#fff',
                        fontWeight: 700,
                        cursor: 'pointer',
                        opacity: commentBusy ? 0.6 : 1,
                      }}
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDeleteMyComment(c)}
                      disabled={commentBusy}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 10,
                        border: 'none',
                        background: '#E63946',
                        color: '#fff',
                        fontWeight: 800,
                        cursor: 'pointer',
                        opacity: commentBusy ? 0.6 : 1,
                      }}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* 이번 달 크루 현황 (반 페이지 하단) */}
      <div style={{ marginTop: 28 }}>
        <p style={{ fontWeight: 700, marginBottom: 8 }}>🏅 이번 달 크루 현황</p>
        {(!crewStatus || crewStatus.length === 0) ? (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: '#F8FAFF',
              border: '1px solid #E2E8F0',
              fontSize: 13,
              color: '#64748B',
            }}
          >
            아직 현황을 표시할 참여자가 없습니다.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 12,
                background: '#F8FAFF',
                borderRadius: 12,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      borderBottom: '1px solid #CBD5E1',
                      padding: 6,
                    }}
                  >
                    이름
                  </th>
                  <th
                    style={{
                      borderBottom: '1px solid #CBD5E1',
                      padding: 6,
                      textAlign: 'right',
                    }}
                  >
                    진행률
                  </th>
                  <th
                    style={{
                      borderBottom: '1px solid #CBD5E1',
                      padding: 6,
                      textAlign: 'right',
                    }}
                  >
                    읽은 장
                  </th>
                  <th
                    style={{
                      borderBottom: '1px solid #CBD5E1',
                      padding: 6,
                      textAlign: 'center',
                    }}
                  >
                    상태
                  </th>
                  <th
                    style={{
                      borderBottom: '1px solid #CBD5E1',
                      padding: 6,
                      textAlign: 'center',
                    }}
                  >
                    메달
                  </th>
                </tr>
              </thead>
              <tbody>
                {crewStatus.map((u) => (
                  <tr key={u.uid}>
                    <td
                      style={{
                        borderBottom: '1px solid #E2E8F0',
                        padding: 6,
                      }}
                    >
                      {u.name}
                    </td>
                    <td
                      style={{
                        borderBottom: '1px solid #E2E8F0',
                        padding: 6,
                        textAlign: 'right',
                      }}
                    >
                      {u.progress}%
                    </td>
                    <td
                      style={{
                        borderBottom: '1px solid #E2E8F0',
                        padding: 6,
                        textAlign: 'right',
                      }}
                    >
                      {u.chapters}장
                    </td>
                    <td
                      style={{
                        borderBottom: '1px solid #E2E8F0',
                        padding: 6,
                        textAlign: 'center',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 16px',
                          borderRadius: 8,
                          background:
                            u.stateKey === 'success'
                              ? '#DCFCE7'
                              : u.stateKey === 'running'
                              ? '#DBEAFE'
                              : u.stateKey === 'fail' || u.stateKey === 'shortage'
                              ? '#E5E7EB'
                              : 'transparent',
                          color:
                            u.stateKey === 'success'
                              ? '#166534'
                              : u.stateKey === 'running'
                              ? '#1D4ED8'
                              : u.stateKey === 'fail' || u.stateKey === 'shortage'
                              ? '#111827'
                              : '#166534',
                          fontWeight: 600,
                        }}
                      >
                        {u.stateLabel || '🟢 오늘준비'}
                      </span>
                    </td>
                    <td
                      style={{
                        borderBottom: '1px solid #E2E8F0',
                        padding: 6,
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                        {u.medals && (u.medals.gold || 0) > 0 && (
                          <div className="medal-wrapper">
                            <span className="medal-icon">🥇</span>
                            <span className="medal-count">{u.medals.gold}</span>
                          </div>
                        )}
                        {u.medals && (u.medals.silver || 0) > 0 && (
                          <div className="medal-wrapper">
                            <span className="medal-icon">🥈</span>
                            <span className="medal-count">{u.medals.silver}</span>
                          </div>
                        )}
                        {u.medals && (u.medals.bronze || 0) > 0 && (
                          <div className="medal-wrapper">
                            <span className="medal-icon">🥉</span>
                            <span className="medal-count">{u.medals.bronze}</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 하단 홈으로 버튼 (기존) */}
      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <button
          onClick={() => navigate('/home')}
          style={{
            padding: '10px 24px',
            borderRadius: 999,
            border: 'none',
            background: '#1565C0',
            color: '#fff',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: 15,
            boxShadow: '0 6px 12px rgba(0,0,0,0.2)',
          }}
        >
          ← 홈으로
        </button>
      </div>
    </div>
  );
}


{/* 이번달 크루 현황 */}

