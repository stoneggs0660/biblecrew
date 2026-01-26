import { getMonthDates } from './dateUtils';
import { CREW_KEYS } from './crewConfig';
import { getDailyBiblePortionByCrew } from './bibleUtils';

/**
 * crewsData: Realtime DB /crews 전체 스냅샷
 *   {
 *     고급반: { users: { uid: { checks: { '2025-11-01': true, ... } } } },
 *     중급반: { ... },
 *     초급반: { ... }
 *   }
 *
 * usersMap: /users 전체 스냅샷
 *   {
 *     uid: { name: '홍길동', crew: '고급반', ... }
 *   }
 *
 * 반환:
 *   {
 *     ranking: [{ uid, name, crew, chapters, medal }],
 *     medalCounts: { gold, silver, bronze }
 *   }
 */
export function calculateMonthlyRanking(crewsData = {}, usersMap = {}, now = new Date()){
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const dates = getMonthDates(year, month);   // ['2025-11-01', ...]
  if (!dates || dates.length === 0){
    return { ranking: [], medalCounts: { gold:0, silver:0, bronze:0 } };
  }

  // 날짜별 분량 미리 계산
  const crewNames = CREW_KEYS;
  const portionByCrewAndDate = {};

  crewNames.forEach(crew => {
    const portions = getDailyBiblePortionByCrew(crew, dates);
    const map = {};
    portions.forEach(p => {
      map[p.date] = p;  // { label, chapters, ... }
    });
    portionByCrewAndDate[crew] = map;
  });

  // 사용자별 이번 달 총 장수 계산
  const userTotals = {};

  crewNames.forEach(crew => {
    const crewNode = crewsData && crewsData[crew];
    const usersNode = crewNode && crewNode.users;
    if (!usersNode) return;

    Object.entries(usersNode).forEach(([uid, u]) => {
      const checks = (u && u.checks) || {};
      let chapters = 0;
      dates.forEach(d => {
        if (checks[d]) {
          const portion = portionByCrewAndDate[crew][d];
          if (portion && typeof portion.chapters === 'number'){
            chapters += portion.chapters;
          }
        }
      });

      if (!userTotals[uid]) userTotals[uid] = { uid, chapters: 0, crew };
      userTotals[uid].chapters += chapters;
    });
  });

  // usersMap에 이름 붙이기
  const list = Object.values(userTotals).map(u => {
    const info = usersMap[u.uid] || {};
    return {
      uid: u.uid,
      name: info.name || '이름없음',
      crew: info.crew || u.crew,
      chapters: u.chapters
    };
  });

  // 장수 기준 내림차순 정렬
  list.sort((a,b)=> b.chapters - a.chapters);

  // 메달 부여 (1등: 금, 2등: 은, 3등: 동)
  const medalCounts = { gold:0, silver:0, bronze:0 };
  list.forEach((u, idx) => {
    let medal = null;
    if (u.chapters > 0){
      if (idx === 0){
        medal = 'gold';
        medalCounts.gold++;
      } else if (idx === 1){
        medal = 'silver';
        medalCounts.silver++;
      } else if (idx === 2){
        medal = 'bronze';
        medalCounts.bronze++;
      }
    }
    u.medal = medal;
  });

  return { ranking: list, medalCounts };
}



export function calculateMonthlyRankingForMonth(crewsData = {}, usersMap = {}, year, month){
  const dates = getMonthDates(year, month);
  if (!dates || dates.length === 0){
    return { ranking: [], medalCounts: { gold:0, silver:0, bronze:0 } };
  }

  const crewNames = CREW_KEYS;
  const portionByCrewAndDate = {};

  // 각 반별로 날짜별 분량(장 수) 캐시
  crewNames.forEach((crew) => {
    const portions = getDailyBiblePortionByCrew(crew, dates);
    const map = {};
    (portions || []).forEach((p) => {
      if (!p || !p.date) return;
      map[p.date] = p;
    });
    portionByCrewAndDate[crew] = map;
  });

  // 사용자별 이번 달 총 장수 계산
  const userTotals = {};

  crewNames.forEach((crew) => {
    const crewNode = crewsData && crewsData[crew];
    const usersNode = crewNode && crewNode.users;
    if (!usersNode) return;

    const portionMap = portionByCrewAndDate[crew] || {};

    Object.entries(usersNode).forEach(([uid, u]) => {
      const checks = (u && u.checks) || {};
      let chapters = 0;

      dates.forEach((d) => {
        if (checks[d]) {
          const portion = portionMap[d];
          if (portion && typeof portion.chapters === 'number' && portion.chapters > 0) {
            chapters += portion.chapters;
          }
        }
      });

      if (!userTotals[uid]) {
        userTotals[uid] = {
          uid,
          crew,
          chapters: 0,
        };
      }
      userTotals[uid].chapters += chapters;
    });
  });

  // 메달 기준: 절대 "진행률"이나 "순위"가 아니라, 장수 기준
  const GOLD_CHAPTERS = 1189; // 성경 전체 완독
  const SILVER_CHAPTERS = 929; // 구약 완독
  const BRONZE_CHAPTERS = 260; // 신약 완독

  // usersMap을 붙이고, 각 반 기준으로 장수 조건이 충족된 경우에만 메달 부여
  const list = Object.values(userTotals).map((u) => {
    const info = usersMap[u.uid] || {};
    const crew = info.crew || u.crew;
    let medal = null;

    if (crew === '고급반' && u.chapters >= GOLD_CHAPTERS) {
      medal = 'gold';
    } else if (crew === '중급반' && u.chapters >= SILVER_CHAPTERS) {
      medal = 'silver';
    } else if (crew === '초급반' && u.chapters >= BRONZE_CHAPTERS) {
      medal = 'bronze';
    }

    return {
      uid: u.uid,
      name: info.name || '이름없음',
      crew,
      chapters: u.chapters,
      medal,
    };
  });

  // 정렬은 여전히 누적 장 기준
  list.sort((a, b) => b.chapters - a.chapters);

  const medalCounts = { gold: 0, silver: 0, bronze: 0 };
  list.forEach((u) => {
    if (u.medal === 'gold') medalCounts.gold++;
    if (u.medal === 'silver') medalCounts.silver++;
    if (u.medal === 'bronze') medalCounts.bronze++;
  });

  return { ranking: list, medalCounts };
}

// 옛 인터페이스 호환용 (현재는 사용하지 않음)
export async function fetchAllCrewData(){ return {}; }
export async function fetchUserNames(){ return {}; }