import React, { useEffect, useState } from 'react';
import { subscribeToCrewChecks, subscribeToUserMedals, subscribeToMonthlyHallOfFame } from '../firebaseSync';
import { getMonthDates } from '../utils/dateUtils';
import { getDailyBiblePortionByCrew } from '../utils/bibleUtils';

import { CREW_KEYS, getCrewLabel } from '../utils/crewConfig';
const CREWS = CREW_KEYS;

export default function Records({ user }) {
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
      <div style={{ padding: 20, minHeight: '100vh', background: '#F8F9FF' }}>
        <h2>👤 내 기록</h2>
        <p>먼저 로그인 후 이용해 주세요.</p>
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

  // crew/year-month 별로 분량(장수)를 캐시하여 재사용
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


  // 명예의 전당 수동/자동 메달이 있는 경우,
  // 해당 월의 최소 장 수(반별 목표 기준)를 개인 기록에 반영한다.
  if (user && user.uid && monthlyHoF && user.crew) {
    const monthNode = monthlyHoF[currentMonth];
    if (monthNode) {
      let target = 0;
      const isGold = monthNode.gold && monthNode.gold[user.uid];
      const isSilver = monthNode.silver && monthNode.silver[user.uid];
      const isBronze = monthNode.bronze && monthNode.bronze[user.uid];

      if (isGold || isSilver || isBronze) {
        // 사용자의 반에 해당하는 이번 달 전체 목표 장수 계산
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

  return (
    <div style={{ padding: 20, minHeight: '100vh', background: '#E5F3E6' }}>
      <h2 style={{ marginBottom: 10 }}>👤 내 기록</h2>
      <p style={{ marginBottom: 20 }}>로그인한 사용자의 누적 체크 현황입니다.</p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          maxWidth: 400,
          marginBottom: 30,
        }}
      >
        <div
          style={{
            background: '#fff',
            padding: 16,
            borderRadius: 10,
            boxShadow: '0 4px 6px rgba(0,0,0,0.08)',
          }}
        >
          <strong>오늘 달린 거리</strong>
          <div style={{ fontSize: 20, marginTop: 8 }}>
            {todayChapters}장 ({todayKm}km)
          </div>
        </div>
        <div
          style={{
            background: '#fff',
            padding: 16,
            borderRadius: 10,
            boxShadow: '0 4px 6px rgba(0,0,0,0.08)',
          }}
        >
          <strong>이번 달 누적 거리</strong>
          <div style={{ fontSize: 20, marginTop: 8 }}>
            {monthChapters}장 ({monthKm}km)
          </div>
        </div>
        <div
          style={{
            background: '#fff',
            padding: 16,
            borderRadius: 10,
            boxShadow: '0 4px 6px rgba(0,0,0,0.08)',
          }}
        >
          <strong>올해 총 누적 거리</strong>
          <div style={{ fontSize: 20, marginTop: 8 }}>
            {yearChapters}장 ({yearKm}km)
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            padding: 16,
            borderRadius: 10,
            boxShadow: '0 4px 6px rgba(0,0,0,0.08)',
            marginTop: 12,
          }}
        >
          <strong>올해 메달 기록</strong>
          <div style={{ fontSize: 16, marginTop: 8, lineHeight: 1.6 }}>
            <div>🥇 금메달: {medals.gold || 0}개</div>
            <div>🥈 은메달: {medals.silver || 0}개</div>
            <div>🥉 동메달: {medals.bronze || 0}개</div>
          </div>
        </div>
      </div>
    </div>
  );
}
