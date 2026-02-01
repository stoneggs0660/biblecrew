// utils/crewStatusUtils.js
// 크루 현황(이름/진행률/읽은 장/상태/메달) 계산을 화면 간 동일하게 쓰기 위한 유틸

/**
 * 상태(성공/러닝중/오늘준비/미달)를 계산합니다.
 *
 * 기준(요청 반영):
 * - 🔵 러닝 중.. : 오늘 성경읽기 페이지를 열었으면(방문=true) 오늘 체크 여부와 무관하게 기본 표시,
 *   단 오늘 체크가 true가 되는 순간 '성공'이 우선됩니다.
 * - 🏁 성공 : 1일~오늘까지 모두 체크(true)
 * - 🟢 오늘준비 : 1일~어제까지 모두 체크(true)이고, 오늘은 아직 체크/방문이 없는 기본 상태
 * - ⚪ 미달 : 1일~어제까지 중 체크 누락이 1번이라도 있음(단, 오늘 방문이 있으면 '러닝 중..'로 덮어씀)
 */
export function getTodayCrewState({ dates, todayKey, userChecks, userDailyActivity }) {
  const checks = userChecks || {};
  const daily = userDailyActivity || {};

  const todayChecked = !!checks[todayKey];
  const todayVisited = !!(daily[todayKey] && daily[todayKey].biblePageVisited);

  const idx = Array.isArray(dates) ? dates.indexOf(todayKey) : -1;
  const uptoToday = idx >= 0 ? dates.slice(0, idx + 1) : [];
  const uptoYesterday = idx > 0 ? dates.slice(0, idx) : [];

  const allUntilToday = uptoToday.length > 0 && uptoToday.every((d) => !!checks[d]);
  const allUntilYesterday = uptoYesterday.length === 0 ? true : uptoYesterday.every((d) => !!checks[d]);
  const anyMissedBeforeToday = uptoYesterday.some((d) => !checks[d]);

  // 우선순위: 성공 > 러닝중 > 오늘준비 > 미달
  if (allUntilToday) {
    return { key: 'success', label: '🏁 성공' };
  }
  if (todayVisited && !todayChecked) {
    return { key: 'running', label: '🔵 러닝 중..' };
  }
  if (allUntilYesterday && !todayChecked) {
    return { key: 'ready', label: '🟢 오늘준비' };
  }
  if (anyMissedBeforeToday) {
    return { key: 'missed', label: '⚪ 힘을내!' };
  }
  // fallback: 데이터가 비어있는 경우 등
  return { key: 'ready', label: '🟢 오늘준비' };
}
