import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToCrewChecks, subscribeToUserMedals, subscribeToMonthlyHallOfFame } from '../firebaseSync';
import { getMonthDates } from '../utils/dateUtils';
import { getDailyBiblePortionByCrew } from '../utils/bibleUtils';

import { CREW_KEYS, getCrewLabel } from '../utils/crewConfig';
import { calculateDokStatus } from '../utils/dokUtils';
const CREWS = CREW_KEYS;

export default function Records({ user }) {
  const navigate = useNavigate();
  const [checksByCrew, setChecksByCrew] = useState({});
  const [medals, setMedals] = useState({});
  const [monthlyHoF, setMonthlyHoF] = useState({});

  useEffect(() => {
    if (!user || !user.uid) return;
    const unsub = subscribeToUserMedals(user.uid, (m) => setMedals(m || {}));
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [user]);

  useEffect(() => {
    if (!user || !user.uid) return;
    const now = new Date();
    const currentYear = now.getFullYear();
    const unsub = subscribeToMonthlyHallOfFame(currentYear, (data) => {
      setMonthlyHoF(data || {});
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [user]);


  useEffect(() => {
    if (!user || !user.uid) return;
    const unsubs = [];
    CREWS.forEach((crew) => {
      const unsub = subscribeToCrewChecks(crew, user.uid, (data) => {
        setChecksByCrew((prev) => ({ ...prev, [crew]: data || {} }));
      });
      if (typeof unsub === 'function') unsubs.push(unsub);
    });
    return () => {
      unsubs.forEach((fn) => {
        try { fn(); } catch (e) { }
      });
    };
  }, [user]);

  if (!user || !user.uid) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        fontFamily: "'Outfit', 'Roboto', sans-serif"
      }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 20 }}>👤 내 기록</h2>
        <p style={{ color: '#94A3B8', marginBottom: 30 }}>먼저 로그인 후 이용해 주세요.</p>
        <button
          onClick={() => navigate('/login')}
          style={{
            padding: '12px 30px',
            borderRadius: 12,
            border: 'none',
            background: '#1B9C5A',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          로그인하러 가기
        </button>
      </div>
    );
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const todayKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  let todayChapters = 0;
  let monthChapters = 0;
  let yearChapters = 0;

  const portionCache = {};

  CREWS.forEach((crew) => {
    const checks = checksByCrew[crew] || {};
    Object.entries(checks).forEach(([date, value]) => {
      if (!value) return;
      const [yStr, mStr] = date.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      if (!y || !m) return;

      const cacheKey = `${crew}_${yStr}-${mStr}`;
      if (!portionCache[cacheKey]) {
        const monthDates = getMonthDates(y, m);
        const portions = getDailyBiblePortionByCrew(crew, monthDates);
        const map = {};
        portions.forEach((p) => {
          map[p.date] = p.chapters || 0;
        });
        portionCache[cacheKey] = map;
      }
      const chapters = portionCache[cacheKey][date] || 0;

      if (date === todayKey) {
        todayChapters += chapters;
      }
      if (y === currentYear && m === currentMonth) {
        monthChapters += chapters;
      }
      if (y === currentYear) {
        yearChapters += chapters;
      }
    });
  });

  if (user && user.uid && monthlyHoF && user.crew) {
    const monthNode = monthlyHoF[currentMonth];
    if (monthNode) {
      let target = 0;
      const isGold = monthNode.gold && monthNode.gold[user.uid];
      const isSilver = monthNode.silver && monthNode.silver[user.uid];
      const isBronze = monthNode.bronze && monthNode.bronze[user.uid];

      if (isGold || isSilver || isBronze) {
        const cacheKey = `${user.crew}_${currentYear}-${currentMonth}`;
        if (!portionCache[cacheKey]) {
          const monthDates = getMonthDates(currentYear, currentMonth);
          const portions = getDailyBiblePortionByCrew(user.crew, monthDates);
          const map = {};
          portions.forEach((p) => {
            map[p.date] = p.chapters || 0;
          });
          portionCache[cacheKey] = map;
        }
        const targetMap = portionCache[cacheKey];
        target = Object.values(targetMap).reduce((a, b) => a + b, 0);
      }

      if (target > 0 && target > monthChapters) {
        const diff = target - monthChapters;
        monthChapters = target;
        yearChapters += diff;
      }
    }
  }

  const todayKm = (todayChapters / 10).toFixed(1);
  const monthKm = (monthChapters / 10).toFixed(1);
  const yearKm = (yearChapters / 10).toFixed(1);

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '24px',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    flex: 1
  };

  const labelStyle = { color: '#94A3B8', fontSize: 14, fontWeight: 500, marginBottom: 8 };
  const valueStyle = { fontSize: 24, fontWeight: 800, color: '#F8FAFC' };

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
            background: 'linear-gradient(to right, #10B981, #34D399, #10B981)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: -1,
            marginBottom: 10
          }}>
            👤 내 활동 기록
          </h1>
          <p style={{ color: '#94A3B8', fontSize: 18 }}>{user.name}님의 성경 러닝 데이터를 확인하세요</p>
        </div>

        {/* 대시보드 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 30 }}>
          <div style={cardStyle}>
            <div style={labelStyle}>🏃 오늘 달린 거리</div>
            <div style={valueStyle}>{todayChapters}장 <span style={{ fontSize: 16, color: '#34D399' }}>({todayKm}km)</span></div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>📅 이번 달 누적</div>
            <div style={valueStyle}>{monthChapters}장 <span style={{ fontSize: 16, color: '#34D399' }}>({monthKm}km)</span></div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>📊 올해 총 누적</div>
            <div style={valueStyle}>{yearChapters}장 <span style={{ fontSize: 16, color: '#34D399' }}>({yearKm}km)</span></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {/* 메달 통계 */}
          <div style={{ ...cardStyle, border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#F59E0B' }}>🏆</span> 올해 획득 메달
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '10px 0' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 5 }}>🥇</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{medals.gold || 0}</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>Gold</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 5 }}>🥈</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{medals.silver || 0}</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>Silver</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 5 }}>🥉</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{medals.bronze || 0}</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>Bronze</div>
              </div>
            </div>

          </div>
          {/* 올해 완주 현황 별도 박스 */}
          <div style={{ ...cardStyle, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#10B981' }}>🏅</span> 올해 완주 현황
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {(() => {
                const currentYearStr = String(new Date().getFullYear());
                const earned = user?.earnedMedals || {};
                const counts = {};
                Object.keys(earned).forEach(key => {
                  if (key.startsWith(currentYearStr)) {
                    const parts = key.split('_');
                    const crewName = parts.length > 1 ? parts[1] : '';
                    if (crewName) counts[crewName] = (counts[crewName] || 0) + 1;
                  }
                });
                const entries = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
                if (entries.length === 0) return <span style={{ color: '#94A3B8' }}>올해 수료한 반이 아직 없습니다.</span>;
                return entries.map(([crew, count], idx) => (
                  <div key={idx} style={{
                    fontSize: 14,
                    fontWeight: 700,
                    background: 'rgba(255,255,255,0.03)',
                    padding: '12px 20px',
                    borderRadius: 16,
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}>
                    <span>{crew}</span>
                    <span style={{
                      background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                      color: '#000',
                      padding: '4px 12px',
                      borderRadius: 10,
                      fontSize: 16,
                      fontWeight: 900,
                      boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)'
                    }}>x{count}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
          {/* 완독 현황 */}
          <div style={{ ...cardStyle, border: '1px solid rgba(233, 196, 106, 0.3)', background: 'linear-gradient(135deg, rgba(233, 196, 106, 0.05) 0%, rgba(30, 41, 59, 0.5) 100%)' }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#E9C46A' }}>📖</span> 성경 전체 완독 현황
            </h3>
            {(() => {
              const dok = calculateDokStatus(user?.earnedMedals || {});
              return (
                <div>
                  <div style={{ textAlign: 'center', padding: '10px 0', marginBottom: 20 }}>
                    <div style={{ fontSize: 44, fontWeight: 900, color: '#E9C46A', textShadow: '0 0 20px rgba(233, 196, 106, 0.3)' }}>
                      {dok.totalDok}<span style={{ fontSize: 20, marginLeft: 4 }}>독 달성</span>
                    </div>
                  </div>

                  {dok.fragments && dok.fragments.length > 0 && (
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: 15, borderRadius: 12 }}>
                      <div style={{ fontSize: 13, color: '#E9C46A', fontWeight: 700, marginBottom: 10 }}>현재 보관 중인 수료 조각</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {dok.fragments.map(f => (
                          <div key={f.name} style={{
                            fontSize: 12,
                            background: 'rgba(255,255,255,0.05)',
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#CBD5E1'
                          }}>
                            {f.name.replace('초급반', '초')} <span style={{ fontWeight: 800, color: '#fff' }}>x{f.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* 푸터 버튼 */}
        <div style={{ marginTop: 50, textAlign: 'center' }}>
          <button
            onClick={() => navigate('/home')}
            style={{
              padding: '12px 40px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              transition: '0.2s'
            }}
          >
            ← 홈으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
