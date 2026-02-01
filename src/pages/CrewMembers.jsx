import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToAllCrewChecks, subscribeToUsers } from '../firebaseSync';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { CREW_KEYS, getCrewLabel } from '../utils/crewConfig';
import { getMonthDates } from '../utils/dateUtils';
import { getDailyBiblePortionByCrew } from '../utils/bibleUtils';
import { getTodayCrewState } from '../utils/crewStatusUtils';

export default function CrewMembers({ user }) {
  const navigate = useNavigate();
  const [crews, setCrews] = useState({});
  const [users, setUsers] = useState({});
  const [approvalLists, setApprovalLists] = useState({});

  useEffect(() => {
    const unsubCrews = subscribeToAllCrewChecks((c) => setCrews(c || {}));
    const unsubUsers = subscribeToUsers((u) => setUsers(u || {}));

    // ✅ 관리자 승인 목록 구독 추가 (현재 달 기준)
    const now = new Date();
    const ymKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const unsubs = [];
    CREW_KEYS.forEach((crew) => {
      const path = ref(db, `approvals/${ymKey}/${crew}`);
      const unsub = onValue(path, (snap) => {
        const names = snap.val() ? Object.keys(snap.val()) : [];
        setApprovalLists((prev) => ({
          ...prev,
          [crew]: names,
        }));
      });
      unsubs.push(unsub);
    });

    return () => {
      if (typeof unsubCrews === 'function') unsubCrews();
      if (typeof unsubUsers === 'function') unsubUsers();
      unsubs.forEach(fn => fn());
    };
  }, []);

  const dataByCrew = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const dates = getMonthDates(year, month);
    if (!dates || dates.length === 0) return { dates: [], todayKey: '', byCrew: {} };

    const today = now.getDate();
    const todayKey = `${year}-${String(month).padStart(2, '0')}-${String(today).padStart(2, '0')}`;
    const uptoDates = dates.slice(0, today);

    const byCrew = {};
    CREW_KEYS.forEach(k => byCrew[k] = []);

    const processedUids = new Set();

    // Pre-calculate portions once for efficiency
    const portionByCrewAndDate = {};
    CREW_KEYS.forEach(crewKey => {
      const portions = getDailyBiblePortionByCrew(crewKey, dates);
      const portionMap = {};
      (portions || []).forEach((p) => {
        if (!p || !p.date) return;
        portionMap[p.date] = typeof p.chapters === 'number' ? p.chapters : 0;
      });
      portionByCrewAndDate[crewKey] = portionMap;
    });

    // Helper function to encapsulate the logic for adding a member
    // Defined inside useMemo to capture its scope and dependencies
    // Helper function (defined inside useMemo for closure access)
    const addMemberData = (crew, uid, info) => {
      // 1. 유효성 체크
      if (!crew) return;
      if (!byCrew[crew]) return; // 존재하지 않는 반 키라면 무시

      const crewNode = crews[crew] || {};
      const usersNode = (crewNode.users && crewNode.users[uid]) || {}; // 크루 데이터 내 유저 노드

      const portionMap = portionByCrewAndDate[crew] || {};

      const u = usersNode || {};
      const userChecks = u.checks || {};

      let readChapters = 0;
      let requiredChapters = 0;

      uptoDates.forEach((d) => {
        const ch = portionMap[d] || 0;
        if (!ch) return;
        requiredChapters += ch;
        if (userChecks[d]) readChapters += ch;
      });

      const name = info.name || uid;
      const medals = info.medals || {};
      const progress = requiredChapters > 0 ? Math.round((readChapters / requiredChapters) * 100) : 0;

      const state = getTodayCrewState({
        dates,
        todayKey,
        userChecks,
        userDailyActivity: info.dailyActivity || {},
      });

      // 리스트에 푸시
      byCrew[crew].push({
        uid,
        name,
        chapters: readChapters,
        progress,
        stateKey: state.key,
        stateLabel: state.label,
        medals,
      });
    };

    // 1. 승인 명단 기준
    CREW_KEYS.forEach((crew) => {
      const approvedUids = approvalLists[crew] || [];
      approvedUids.forEach((uid) => {
        processedUids.add(uid);
        commonAddLogic(crew, uid);
      });
    });

    // 2. DB crew 기준 (누락된 인원)
    Object.entries(users || {}).forEach(([uid, info]) => {
      if (processedUids.has(uid)) return;
      const c = info.crew;
      if (c && byCrew[c]) {
        commonAddLogic(c, uid);
      }
    });

    // 정렬
    Object.keys(byCrew).forEach(k => {
      byCrew[k].sort((a, b) => (b.chapters || 0) - (a.chapters || 0));
    });

    return { dates, todayKey, byCrew };
  }, [crews, users, approvalLists]);

  return (
    <div
      style={{
        padding: 25,
        minHeight: '100vh',
        background: '#E5F3E6',
        color: '#034732',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 26 }}>👥 이번 달 크루원</h2>
        <button
          onClick={() => navigate('/home')}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: 'none',
            background: '#E8F6F0',
            color: '#1E7F74',
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          ← 홈화면 돌아가기
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#2F3A33', marginBottom: 14 }}>
        상태는 <b>🏁 성공 / 🔵 러닝 중.. / 🟢 오늘준비 / ⚪ 힘을내!</b> 기준으로 표시됩니다.
      </div>

      {CREW_KEYS.map((crew) => {
        const list = (dataByCrew.byCrew && dataByCrew.byCrew[crew]) || [];
        return (
          <div
            key={crew}
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 12,
              background: '#FFFFFF',
              boxShadow: '0 4px 10px rgba(0,0,0,0.06)',
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 10 }}>{getCrewLabel(crew)}</h3>

            {list.length === 0 ? (
              <div style={{ fontSize: 12, color: '#64748B' }}>아직 현황을 표시할 참여자가 없습니다.</div>
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
                      <th style={{ borderBottom: '1px solid #CBD5E1', padding: 6, textAlign: 'left' }}>이름</th>
                      <th style={{ borderBottom: '1px solid #CBD5E1', padding: 6, textAlign: 'right' }}>진행률</th>
                      <th style={{ borderBottom: '1px solid #CBD5E1', padding: 6, textAlign: 'right' }}>읽은 장</th>
                      <th style={{ borderBottom: '1px solid #CBD5E1', padding: 6, textAlign: 'center' }}>상태</th>
                      <th style={{ borderBottom: '1px solid #CBD5E1', padding: 6, textAlign: 'center' }}>메달</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((u) => (
                      <tr key={u.uid}>
                        <td style={{ borderBottom: '1px solid #E2E8F0', padding: 6 }}>{u.name}</td>
                        <td style={{ borderBottom: '1px solid #E2E8F0', padding: 6, textAlign: 'right' }}>{u.progress}%</td>
                        <td style={{ borderBottom: '1px solid #E2E8F0', padding: 6, textAlign: 'right' }}>{u.chapters}장</td>
                        <td style={{ borderBottom: '1px solid #E2E8F0', padding: 6, textAlign: 'center' }}>
                          {(() => {
                            const label = u.stateLabel || '🟢 오늘준비';
                            const key = u.stateKey || '';
                            const isSuccess = key === 'success' || label.includes('성공');
                            const isReady = key === 'ready' || label.includes('오늘준비');
                            const isRunning = key === 'running' || label.includes('러닝');
                            const isFail = key === 'fail' || label.includes('힘을내!') || key === 'shortage';

                            if (isReady) {
                              return (
                                <span style={{ color: '#166534', fontWeight: 600 }}>
                                  {label}
                                </span>
                              );
                            }

                            const style = {
                              display: 'inline-block',
                              borderRadius: 8,
                              padding: '4px 16px',
                              fontWeight: 600,
                              backgroundColor: isSuccess
                                ? '#DCFCE7'
                                : isRunning
                                  ? '#DBEAFE'
                                  : '#E5E7EB',
                              color: isSuccess
                                ? '#166534'
                                : isRunning
                                  ? '#1D4ED8'
                                  : '#111827',
                            };

                            return <span style={style}>{label}</span>;
                          })()}
                        </td>
                        <td style={{ borderBottom: '1px solid #E2E8F0', padding: 6, textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                            {(u.medals?.gold || 0) > 0 && (
                              <div>
                                <span>🥇</span> <b>{u.medals.gold}</b>
                              </div>
                            )}
                            {(u.medals?.silver || 0) > 0 && (
                              <div>
                                <span>🥈</span> <b>{u.medals.silver}</b>
                              </div>
                            )}
                            {(u.medals?.bronze || 0) > 0 && (
                              <div>
                                <span>🥉</span> <b>{u.medals.bronze}</b>
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
        );
      })}
    </div>
  );
}
