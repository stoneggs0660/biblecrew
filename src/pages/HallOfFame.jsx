import React, { useEffect, useMemo, useRef, useState } from 'react';
import { subscribeToHallOfFameYear, subscribeToLegacyMonthlyHallOfFame, saveMonthlyHallOfFame } from '../firebaseSync';
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
  const [yearlyTop10, setYearlyTop10] = useState([]);
  const [activeYear, setActiveYear] = useState(null);   // 자동 전환되는 '올해' 기준(설정값)
  const [selectedYear, setSelectedYear] = useState(null); // 사용자가 보고 있는 연도(기본: activeYear)
  const [availableYears, setAvailableYears] = useState([]);

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
      setYearlyTop10([]);
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
    const add = (name, medal) => {
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

    const list = Object.values(agg);
    list.sort((a, b) => {
      // 1) 점수(내부) 2) 금 3) 은 4) 동 5) 이름
      if (b.points !== a.points) return b.points - a.points;
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      if (b.bronze !== a.bronze) return b.bronze - a.bronze;
      return String(a.name).localeCompare(String(b.name), 'ko');
    });

    setYearlyTop10(list.slice(0, 10));
  }, [hofYearData, legacyMonthlyData, selectedYear]);

  const months = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], []);
  const currentMonth = useMemo(() => new Date().getMonth() + 1, []);
  const currentMonth2 = useMemo(() => String(new Date().getMonth() + 1).padStart(2, '0'), []);

  return (
    <div style={{ padding: 20, minHeight: '100vh', background: '#F4F5FB' }}>
      <h2 style={{ color: '#FF9F1C', marginBottom: 10 }}>🏅 명예의 전당</h2>

      {/* ✅ 연도 선택 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ fontWeight: 'bold' }}>연도</div>
        <select
          value={selectedYear || ''}
          onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}
        >
          {(availableYears && availableYears.length ? availableYears : (activeYear ? [activeYear] : [])).map((y) => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
        {activeYear && selectedYear && activeYear !== selectedYear && (
          <span style={{ fontSize: 13, color: '#666' }}>과거 기록을 조회 중입니다.</span>
        )}
      </div>

      {selectedYear && (
        <p style={{ marginBottom: 20 }}>
          {selectedYear}년 명예의 전당 기록입니다.
        </p>
      )}

      {/* 연간 TOP 10 */}
      <div style={{ marginBottom: 24, padding: 16, background: '#fff', borderRadius: 8, boxShadow: '0 4px 6px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>연간 TOP 10</h3>
        {(!yearlyTop10 || yearlyTop10.length === 0) && (
          <p>아직 확정된 명예의 전당 기록이 없습니다.</p>
        )}
        {yearlyTop10 && yearlyTop10.map((u, idx) => (
          <div key={u.name || idx} style={{
            background: '#fff',
            padding: 10,
            borderRadius: 6,
            marginBottom: 8,
            border: '1px solid #eee',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <strong>{idx + 1}위</strong>&nbsp; {u.name}
            </div>
            <div style={{ fontSize: 13, color: '#555' }}>
              {u.gold ? <span style={{ marginRight: 10 }}>금 {u.gold}</span> : null}
              {u.silver ? <span style={{ marginRight: 10 }}>은 {u.silver}</span> : null}
              {u.bronze ? <span>동 {u.bronze}</span> : null}
            </div>
          </div>
        ))}
      </div>

      {/* 월중 진행 현황 (올해만, 현재 월) */}
      {activeYear && selectedYear === activeYear && (
        <div style={{ marginBottom: 24, padding: 16, background: '#fff', borderRadius: 8, boxShadow: '0 4px 6px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginTop: 0 }}>{currentMonth}월 도전 현황</h3>
          {['gold', 'silver', 'bronze'].map((medal) => {
            const s = monthlyStatus?.[medal] || {};
            const challengers = Number(s.challengers || 0);
            const success = Number(s.success || 0);
            const fail = Number(s.fail || 0);
            const label = medal === 'gold' ? '금메달 🥇' : medal === 'silver' ? '은메달 🥈' : '동메달 🥉';
            return (
              <div key={medal} style={{ marginBottom: 8, fontSize: 15 }}>
                {label} : {challengers}명 도전중 ({success}명 성공 · {fail}명 실패)
              </div>
            );
          })}
          <div style={{ fontSize: 12, color: '#777', marginTop: 8 }}>
            ※ 월중에는 "성공/실패"가 확정값이 아니라 현재 상태(달성/힘을내!)입니다.
          </div>
        </div>
      )}

      {/* 월별 메달 결과(월 종료 확정): 성공자 이름만 */}
      <div style={{ marginBottom: 24, padding: 16, background: '#fff', borderRadius: 8, boxShadow: '0 4px 6px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>월별 메달 결과</h3>
        {months.map((m) => {
          const mm = String(m).padStart(2, '0');

          // 신규 구조
          const mDataNew = hofYearData?.monthlyResults?.[mm];
          const goldNew = Array.isArray(mDataNew?.gold) ? mDataNew.gold : null;
          const silverNew = Array.isArray(mDataNew?.silver) ? mDataNew.silver : null;
          const bronzeNew = Array.isArray(mDataNew?.bronze) ? mDataNew.bronze : null;

          // 구버전 폴백
          const mDataOld = legacyMonthlyData && legacyMonthlyData[m];
          const toNames = (bucket) => (bucket && typeof bucket === 'object') ? Object.values(bucket).map((x) => x?.name).filter(Boolean) : null;
          const goldOld = toNames(mDataOld?.gold);
          const silverOld = toNames(mDataOld?.silver);
          const bronzeOld = toNames(mDataOld?.bronze);

          const gold = goldNew ?? goldOld;
          const silver = silverNew ?? silverOld;
          const bronze = bronzeNew ?? bronzeOld;

          // 동메달 반별 그룹화 함수
          const renderBronzeByCrew = (items) => {
            if (!items || !items.length) return '없음';
            // 데이터 형식이 객체인지 문자열인지 확인
            const groups = {};
            items.forEach(item => {
              const name = typeof item === 'object' ? item.name : item;
              const crew = typeof item === 'object' ? item.crew : '기타';
              if (!groups[crew]) groups[crew] = [];
              groups[crew].push(name);
            });

            return Object.entries(groups).map(([crewName, names], idx) => {
              const label = getCrewLabel(crewName);
              return (
                <div key={crewName} style={{ marginBottom: 4 }}>
                  <span style={{ color: '#1E40AF', fontWeight: 800 }}>{label}:</span> {names.join(' · ')}
                </div>
              );
            });
          };

          const formatNames = (items) => {
            if (!items || !items.length) return '없음';
            return items.map(it => typeof it === 'object' ? it.name : it).join(' · ');
          };

          const hasAny = (gold && gold.length) || (silver && silver.length) || (bronze && bronze.length);
          return (
            <div key={m} style={{ marginBottom: 12 }}>
              <strong>{m}월</strong>
              {!hasAny && <div style={{ fontSize: 13, color: '#777' }}>아직 확정된 메달 기록이 없습니다.</div>}
              {hasAny && (
                <div style={{ marginLeft: 10, fontSize: 14 }}>
                  <div>
                    금메달 🥇 : {formatNames(gold)}
                  </div>
                  <div>
                    은메달 🥈 : {formatNames(silver)}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontWeight: 800, marginBottom: 2 }}>동메달 🥉</div>
                    <div style={{ paddingLeft: 10 }}>{renderBronzeByCrew(bronze)}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
