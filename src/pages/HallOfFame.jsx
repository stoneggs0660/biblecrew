import React, { useEffect, useMemo, useRef, useState } from 'react';
import { subscribeToHallOfFameYear, subscribeToLegacyMonthlyHallOfFame, saveMonthlyHallOfFame, subscribeToUsers } from '../firebaseSync';
import { calculateDokStatus } from '../utils/dokUtils';
import { db } from '../firebase';
import { ref, onValue, set, get } from 'firebase/database';
import { getMonthDates } from '../utils/dateUtils';
import { CREW_KEYS } from '../utils/crewConfig';

export default function HallOfFame() {
  // hallOfFame/{year} 기준(신규 구조) 데이터
  const [hofYearData, setHofYearData] = useState(null);
  // 구버전(hallOfFame/monthly/{year}) 데이터(필요시만)
  const [legacyMonthlyData, setLegacyMonthlyData] = useState(null);
  const [monthlyStatus, setMonthlyStatus] = useState({}); // 월중 숫자 현황
  const [yearlyTop11, setYearlyTop11] = useState([]);
  const [activeYear, setActiveYear] = useState(null);   // 자동 전환되는 '올해' 기준(설정값)
  const [selectedYear, setSelectedYear] = useState(null); // 사용자가 보고 있는 연도(기본: activeYear)
  const [availableYears, setAvailableYears] = useState([]);
  const [usersMap, setUsersMap] = useState({});

  // 월 종료 자동 확정(성공자 이름 저장)을 하루에 한 번만 시도하도록 보호
  const finalizeOnceRef = useRef(new Set());
  const didAutoFinalizeRef = useRef(new Set());

  // ✅ 1) 새해 자동 전환: settings/currentHallOfFameYear 를 올해로 맞춘다 (없으면 생성)
  useEffect(() => {
    const systemYear = new Date().getFullYear();
    const yRef = ref(db, 'settings/currentHallOfFameYear');

    const unsub = onValue(yRef, async (snap) => {
      const saved = snap.val();
      // 저장값이 없거나 숫자가 아니면 올해로 생성
      if (typeof saved !== 'number') {
        await set(yRef, systemYear);
        return;
      }
      // 새해가 되었으면 자동 전환
      if (saved !== systemYear) {
        await set(yRef, systemYear);
        return;
      }
      setActiveYear(saved);
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // ✅ 2) 과거 연도 목록: hallOfFame/{year} + (구버전) hallOfFame/monthly/{year} + 올해를 합쳐 드롭다운 구성
  useEffect(() => {
    const hofRootRef = ref(db, 'hallOfFame');
    const legacyRootRef = ref(db, 'hallOfFame/monthly');

    const unsubs = [];
    const mergeYears = (arrA, arrB) => {
      const systemYear = new Date().getFullYear();
      const years = [...(arrA || []), ...(arrB || []), systemYear]
        .filter((n) => Number.isFinite(n));
      return Array.from(new Set(years)).sort((a, b) => b - a);
    };

    let yearsA = [];
    let yearsB = [];

    unsubs.push(onValue(hofRootRef, (snap) => {
      const v = snap.val() || {};
      yearsA = Object.keys(v)
        .map((k) => parseInt(k, 10))
        .filter((n) => Number.isFinite(n));
      setAvailableYears(mergeYears(yearsA, yearsB));
    }));

    unsubs.push(onValue(legacyRootRef, (snap) => {
      const v = snap.val() || {};
      yearsB = Object.keys(v)
        .map((k) => parseInt(k, 10))
        .filter((n) => Number.isFinite(n));
      setAvailableYears(mergeYears(yearsA, yearsB));
    }));

    return () => unsubs.forEach((u) => (typeof u === 'function' ? u() : null));
  }, []);

  // ✅ 유저 데이터 구독 (1독 횟수 계산용)
  useEffect(() => {
    const unsub = subscribeToUsers((v) => setUsersMap(v || {}));
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  // ✅ 3) 기본 선택 연도는 activeYear(올해)
  useEffect(() => {
    if (!activeYear) return;
    setSelectedYear((prev) => prev ?? activeYear);
  }, [activeYear]);

  // ✅ 4) 선택 연도 데이터 구독 (신규 구조 우선, 없으면 구버전 폴백)
  useEffect(() => {
    if (!selectedYear) return;
    setHofYearData(null);
    setLegacyMonthlyData(null);

    const unsubA = subscribeToHallOfFameYear(selectedYear, (v) => {
      setHofYearData(v || null);
    });
    const unsubB = subscribeToLegacyMonthlyHallOfFame(selectedYear, (v) => {
      setLegacyMonthlyData(v || null);
    });
    return () => {
      if (typeof unsubA === 'function') unsubA();
      if (typeof unsubB === 'function') unsubB();
    };
  }, [selectedYear]);

  // ✅ 5) 월중 현황(도전중/성공/실패): 별도 집계 DB가 아니라 "원본 체크"(crews/*/users/*/checks)에서 실시간 계산
  // - 도전중: 해당 메달에 해당하는 반(고급/중급/초급*)에 존재하는 사용자 수
  // - 성공/실패: 현재 월의 1일~오늘(포함)까지 모두 체크했으면 성공, 아니면 실패
  useEffect(() => {
    if (!activeYear || !selectedYear) return;
    if (activeYear !== selectedYear) {
      setMonthlyStatus({});
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthDates = getMonthDates(year, month);
    const todayKey = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const requiredDates = monthDates.filter(d => d <= todayKey);

    const medalToCrews = {
      gold: ['고급반'],
      silver: ['중급반'],
      bronze: CREW_KEYS.filter(k => String(k).includes('초급반') || String(k).includes('파노라마')),
    };

    const crewsRef = ref(db, 'crews');
    const unsub = onValue(crewsRef, (snap) => {
      const crewsData = snap.val() || {};
      const next = { gold: { challengers: 0, success: 0, fail: 0 }, silver: { challengers: 0, success: 0, fail: 0 }, bronze: { challengers: 0, success: 0, fail: 0 } };

      (['gold', 'silver', 'bronze']).forEach((medal) => {
        const crewList = medalToCrews[medal] || [];
        crewList.forEach((crewKey) => {
          const usersNode = crewsData?.[crewKey]?.users || {};
          Object.entries(usersNode).forEach(([userKey, u]) => {
            // userKey는 현재 DB 구조에서 '이름'인 경우가 많음
            const displayName = (u && u.name) || userKey;
            next[medal].challengers += 1;
            const checks = (u && u.checks) || {};
            const ok = requiredDates.every((d) => !!checks[d]);
            if (ok) next[medal].success += 1;
            else next[medal].fail += 1;
          });
        });
      });

      setMonthlyStatus(next);

      // ✅ 월 종료 자동 확정(성공자 이름만 저장)
      // - 매월 1일에 "지난 달" 결과를 1회만 확정 저장한다.
      // - 이미 저장되어 있으면 덮어쓰지 않는다.
      if (now.getDate() === 1) {
        const prev = new Date(year, month - 2, 1); // JS month index
        const prevYear = prev.getFullYear();
        const prevMonth = prev.getMonth() + 1;
        const prevMM = String(prevMonth).padStart(2, '0');
        const guardKey = `${prevYear}-${prevMM}`;

        if (!finalizeOnceRef.current.has(guardKey)) {
          finalizeOnceRef.current.add(guardKey);

          const prevDates = getMonthDates(prevYear, prevMonth);
          const successNamesByMedal = { gold: [], silver: [], bronze: [] };

          (['gold', 'silver', 'bronze']).forEach((medal) => {
            const crewList = medalToCrews[medal] || [];
            crewList.forEach((crewKey) => {
              const usersNode = crewsData?.[crewKey]?.users || {};
              Object.entries(usersNode).forEach(([userKey, u]) => {
                const displayName = (u && u.name) || userKey;
                const checks = (u && u.checks) || {};
                const ok = prevDates.every((d) => !!checks[d]);
                // 이름뿐만 아니라 반 정보도 함께 객체로 저장
                if (ok) successNamesByMedal[medal].push({ name: displayName, crew: crewKey });
              });
            });
          });

          // DB에 저장(이미 있으면 skip)
          (async () => {
            // ✅ 중복/경로 통합된 공용 함수 사용
            const ranking = [];
            ['gold', 'silver', 'bronze'].forEach(medal => {
              (successNamesByMedal[medal] || []).forEach(item => {
                // ranking 구조: { uid, name, crew, medal }
                // 현재 userKey(이름)를 uid로 사용 중
                ranking.push({
                  uid: item.name,
                  name: item.name,
                  crew: item.crew,
                  medal: medal
                });
              });
            });

            if (ranking.length > 0) {
              await saveMonthlyHallOfFame(prevYear, prevMonth, ranking);
            }
          })().catch(() => { });
        }
      }
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [activeYear, selectedYear]);

  // ✅ 6) 연간 TOP10 계산: (월 종료 확정 결과) 이름 배열 기반
  // - 신규: hallOfFame/{year}/monthlyResults/{MM}/{medal} = [name...]
  // - 폴백: hallOfFame/monthly/{year}/{MM}/{medal}/{uid}.name
  useEffect(() => {
    if (!selectedYear) {
      setYearlyTop11([]);
      return;
    }

    const monthlyResults = (hofYearData && hofYearData.monthlyResults) ? hofYearData.monthlyResults : null;

    // 결과를 월별로 normalize: { '01': { gold:[name], silver:[name], bronze:[name] }, ... }
    const normalized = {};

    if (monthlyResults && typeof monthlyResults === 'object') {
      Object.entries(monthlyResults).forEach(([mm, medals]) => {
        if (!medals || typeof medals !== 'object') return;
        normalized[mm] = {
          gold: Array.isArray(medals.gold) ? medals.gold.filter(Boolean) : [],
          silver: Array.isArray(medals.silver) ? medals.silver.filter(Boolean) : [],
          bronze: Array.isArray(medals.bronze) ? medals.bronze.filter(Boolean) : [],
        };
      });
    } else if (legacyMonthlyData && typeof legacyMonthlyData === 'object') {
      Object.entries(legacyMonthlyData).forEach(([monthKey, medals]) => {
        const mm = String(monthKey).padStart(2, '0');
        if (!medals || typeof medals !== 'object') return;
        const toNames = (bucket) => {
          if (!bucket || typeof bucket !== 'object') return [];
          return Object.values(bucket).map((info) => info?.name).filter(Boolean);
        };
        normalized[mm] = {
          gold: toNames(medals.gold),
          silver: toNames(medals.silver),
          bronze: toNames(medals.bronze),
        };
      });
    }

    const agg = {}; // name -> { name, gold, silver, bronze, points }
    const add = (item, medal) => {
      if (!item) return;
      // 데이터가 객체형태인 경우와 문자열인 경우 모두 대응
      const name = typeof item === 'string' ? item : item.name;
      if (!name) return;

      if (!agg[name]) agg[name] = { name, gold: 0, silver: 0, bronze: 0, points: 0 };
      if (medal === 'gold') { agg[name].gold += 1; agg[name].points += 3; }
      if (medal === 'silver') { agg[name].silver += 1; agg[name].points += 2; }
      if (medal === 'bronze') { agg[name].bronze += 1; agg[name].points += 1; }
    };

    Object.values(normalized).forEach((m) => {
      (m.gold || []).forEach((n) => add(n, 'gold'));
      (m.silver || []).forEach((n) => add(n, 'silver'));
      (m.bronze || []).forEach((n) => add(n, 'bronze'));
    });

    const list = Object.values(agg).map(u => {
      // 각 유저의 1독 횟수 미리 계산하여 객체에 포함 (정렬용)
      let targetUser = usersMap[u.name];
      if (!targetUser) {
        targetUser = Object.values(usersMap).find(v => v.name === u.name);
      }
      const dok = calculateDokStatus(targetUser?.earnedMedals || {});
      return { ...u, totalDok: dok.totalDok };
    });

    list.sort((a, b) => {
      // 1) 성경 완독(1독) 수 우선
      if (b.totalDok !== a.totalDok) return b.totalDok - a.totalDok;
      // 2) 점수(메달 가중치 합계)
      if (b.points !== a.points) return b.points - a.points;
      // 3) 금 -> 은 -> 동 순
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      if (b.bronze !== a.bronze) return b.bronze - a.bronze;
      return String(a.name).localeCompare(String(b.name), 'ko');
    });

    setYearlyTop11(list.slice(0, 11));
  }, [hofYearData, legacyMonthlyData, selectedYear, usersMap]);

  const months = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], []);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);

  // 현재 선택된 연도/월의 데이터 추출
  const currentMonthData = useMemo(() => {
    if (!hofYearData?.monthlyResults) return null;
    const mm = String(viewMonth).padStart(2, '0');
    return hofYearData.monthlyResults[mm] || null;
  }, [hofYearData, viewMonth]);

  // 해당 월에 '1독'을 달성한 사람 추출
  const monthlyDokAchievers = useMemo(() => {
    return currentMonthData?.dokAchievers || [];
  }, [currentMonthData]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
      color: '#F8FAFC',
      padding: '40px 20px',
      fontFamily: "'Outfit', 'Roboto', sans-serif"
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{
            fontSize: 42,
            fontWeight: 900,
            background: 'linear-gradient(to right, #F59E0B, #FBBF24, #F59E0B)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: -1,
            marginBottom: 10
          }}>
            🏅 명예의 전당
          </h1>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 15 }}>
            <select
              value={selectedYear || ''}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: 12,
                fontSize: 18,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {availableYears.map(y => <option key={y} value={y} style={{ color: '#000' }}>{y}년</option>)}
            </select>
            <div style={{ fontSize: 20, color: '#94A3B8', fontWeight: 500 }}>성경러닝크루 명예의 전당</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 30 }}>

          {/* 연간 TOP 11 */}
          <section style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 24,
            padding: 30,
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#F59E0B' }}>🏆</span> {selectedYear}년 명예의 전당 (TOP 11)
            </h2>
            <p style={{ fontSize: 14, color: '#94A3B8', marginBottom: 20, marginLeft: 34 }}>누적 성경 전체완독-메달 점수 랭킹 입니다</p>
            {yearlyTop11.length === 0 ? (
              <p style={{ color: '#64748B', textAlign: 'center' }}>아직 집계된 랭킹이 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {yearlyTop11.map((u, idx) => (
                  <div key={u.name} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    background: idx === 0 ? 'linear-gradient(90deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)' : 'rgba(255,255,255,0.02)',
                    borderRadius: 16,
                    border: idx === 0 ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                      <div style={{
                        width: 34,
                        height: 34,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: idx < 3 ? 24 : 14,
                        color: idx < 3 ? 'inherit' : '#64748B',
                        fontWeight: 900,
                        background: idx < 3 ? 'transparent' : 'rgba(255,255,255,0.05)',
                        borderRadius: 8
                      }}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: idx < 3 ? 800 : 600 }}>{u.name}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {u.gold > 0 && <span>🥇{u.gold}</span>}
                          {u.silver > 0 && <span>🥈{u.silver}</span>}
                          {u.bronze > 0 && <span>🥉{u.bronze}</span>}
                        </div>
                        {(() => {
                          // 유저 데이터에서 1독 정보 가져오기
                          // 유저 키가 이름일 수 있으므로 탐색
                          let targetUser = usersMap[u.name];
                          if (!targetUser) {
                            targetUser = Object.values(usersMap).find(v => v.name === u.name);
                          }
                          const dok = calculateDokStatus(targetUser?.earnedMedals || {});
                          if (dok.totalDok > 0) {
                            return <span style={{ fontSize: 13, fontWeight: 800, color: '#E9C46A', background: 'rgba(233,196,106,0.1)', padding: '2px 8px', borderRadius: 6 }}>📖 {dok.totalDok}독</span>;
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 월별 기록 조회 */}
          <section>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
              {months.map(m => (
                <button
                  key={m}
                  onClick={() => setViewMonth(m)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: viewMonth === m ? '#F59E0B' : 'rgba(255,255,255,0.05)',
                    color: viewMonth === m ? '#000' : '#94A3B8',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: '0.2s'
                  }}
                >
                  {m}월
                </button>
              ))}
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 24,
              padding: 30,
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 25, textAlign: 'center' }}>
                📅 {viewMonth}월 완주 스포트라이트
              </h3>

              {!currentMonthData ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748B' }}>
                  해당 월의 확정된 기록이 없습니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>

                  {/* 메달 수여자 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                    <MedalCard title="🥇 금메달 (고급)" items={currentMonthData.gold} color="#F59E0B" />
                    <MedalCard title="🥈 은메달 (중급)" items={currentMonthData.silver} color="#94A3B8" />
                    <MedalCard title="🥉 동메달 (초급/기타)" items={currentMonthData.bronze} color="#B45309" />
                  </div>

                  {/* 이달의 1독자 */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20 }}>
                    <h4 style={{ fontSize: 18, fontWeight: 800, marginBottom: 15, color: '#E9C46A' }}>📖 이달의 성경 완독자</h4>
                    <p style={{ fontSize: 14, color: '#94A3B8', marginBottom: 12 }}>* 이번 달에 성경 1독을 완성하신 분들입니다.</p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {monthlyDokAchievers.length === 0 ? (
                        <span style={{ color: '#64748B', fontSize: 14 }}>이번 달 완독자가 아직 없습니다.</span>
                      ) : (
                        monthlyDokAchievers.map((ach, idx) => (
                          <div key={idx} style={{
                            background: 'linear-gradient(135deg, rgba(233,196,106,0.2) 0%, rgba(233,196,106,0.05) 100%)',
                            padding: '10px 18px',
                            borderRadius: 12,
                            border: '1px solid rgba(233,196,106,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}>
                            <span style={{ fontSize: 16, fontWeight: 800, color: '#E9C46A' }}>{ach.name}</span>
                            <span style={{ fontSize: 12, fontWeight: 900, background: '#E9C46A', color: '#000', padding: '2px 6px', borderRadius: 4 }}>
                              {ach.dokCount}독 달성
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          </section>

        </div>

        <div style={{ marginTop: 50, textAlign: 'center' }}>
          <button
            onClick={() => window.history.back()}
            style={{
              padding: '12px 30px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ← 뒤로 가기
          </button>
        </div>
      </div>
    </div>
  );
}

function MedalCard({ title, items, color }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      padding: 20,
      borderRadius: 18,
      border: `1px solid ${color}33`
    }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: color, marginBottom: 12, borderBottom: `1px solid ${color}22`, paddingBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, idx) => {
          const name = typeof it === 'string' ? it : it.name;
          const crew = typeof it === 'string' ? '' : it.crew;
          return (
            <div key={idx} style={{ fontSize: 14, fontWeight: 600 }}>
              {name} {crew && <span style={{ fontSize: 11, color: '#64748B', fontWeight: 400 }}>({crew.replace('초급반', '초')})</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}


