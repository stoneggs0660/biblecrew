import { db } from "./firebase";
import { ref, onValue, set, push, getDatabase, get, update } from "firebase/database";
import { CREW_KEYS } from "./utils/crewConfig";

// =========================
// 반(초/중/고) 안내 팝업 관리
// - RTDB 경로: classNotices/{crewName}
// - 사용자 확인 기록: users/{uid}/seenNotices/{crewName} = version
// =========================

export function subscribeToClassNotices(callback) {
  const path = ref(db, 'classNotices');
  const unsubscribe = onValue(path, (snap) => callback(snap.val() || {}));
  return unsubscribe;
}

export function subscribeToClassNotice(crewName, callback) {
  if (!crewName) return () => { };
  const path = ref(db, `classNotices/${crewName}`);
  const unsubscribe = onValue(path, (snap) => callback(snap.val() || null));
  return unsubscribe;
}

export async function getClassNotice(crewName) {
  if (!crewName) return null;
  const db2 = getDatabase();
  const snap = await get(ref(db2, `classNotices/${crewName}`));
  return snap.val() || null;
}

export async function getUserSeenNoticeVersion(uid, crewName) {
  if (!uid || !crewName) return 0;
  const db2 = getDatabase();
  const snap = await get(ref(db2, `users/${uid}/seenNotices/${crewName}`));
  const v = snap.val();
  return typeof v === 'number' ? v : parseInt(v || '0', 10) || 0;
}

export async function markNoticeSeen(uid, crewName, version) {
  if (!uid || !crewName) return false;
  const v = typeof version === 'number' ? version : parseInt(version || '0', 10) || 0;
  const db2 = getDatabase();
  await set(ref(db2, `users/${uid}/seenNotices/${crewName}`), v);
  return true;
}

// 관리자: 반 안내 저장 (저장 시 version 자동 증가)
// crewName === 'all' 인 경우 모든 CREW_KEYS에 동일한 내용을 배포합니다.
export async function saveClassNotice(crewName, payload) {
  if (!crewName) return false;
  const db2 = getDatabase();
  const enabled = !!payload?.enabled;
  const content = (payload?.content || '').toString();
  const title = (payload?.title || '').toString();
  const updatedAt = Date.now();

  if (crewName === 'all') {
    // 1. 'all' 전용 노드 업데이트 (관리자용 기록)
    const allSnap = await get(ref(db2, 'classNotices/all'));
    const allCur = allSnap.val() || {};
    const nextAllVersion = (parseInt(allCur.version || '0', 10) || 0) + 1;
    const allUpdated = { enabled, title, content, version: nextAllVersion, updatedAt };

    const updates = {};
    updates['classNotices/all'] = allUpdated;

    // 2. 모든 반 노드 업데이트 (사용자 노출용)
    for (const crew of CREW_KEYS) {
      const curSnap = await get(ref(db2, `classNotices/${crew}`));
      const cur = curSnap.val() || {};
      const nextV = (parseInt(cur.version || '0', 10) || 0) + 1;
      updates[`classNotices/${crew}`] = {
        enabled,
        title,
        content,
        version: nextV,
        updatedAt,
      };
    }

    await update(ref(db2), updates);
    return allUpdated;
  } else {
    const curSnap = await get(ref(db2, `classNotices/${crewName}`));
    const cur = curSnap.val() || {};
    const nextVersion = (parseInt(cur.version || '0', 10) || 0) + 1;
    const updated = {
      enabled,
      title,
      content,
      version: nextVersion,
      updatedAt,
    };
    await set(ref(db2, `classNotices/${crewName}`), updated);
    return updated;
  }
}

// ✅ 체크 관련
export function subscribeToCrewChecks(crew, uid, callback) {
  const path = ref(db, `crews/${crew}/users/${uid}/checks`);
  const unsubscribe = onValue(path, (snap) => callback(snap.val() || {}));
  return unsubscribe;
}

// ✅ [성능 최적화] 특정 반 전체 데이터 읽기 (내 반 정보만 가져오기 위함)
export function subscribeToSingleCrewData(crew, callback) {
  if (!crew) return () => { };
  const path = ref(db, `crews/${crew}`);
  const unsubscribe = onValue(path, (snap) => callback(snap.val() || {}));
  return unsubscribe;
}

export function saveCrewCheck(crew, uid, date, value) {
  const path = ref(db, `crews/${crew}/users/${uid}/checks/${date}`);
  return set(path, value);
}

export function loadUserChecks(crew, uid, callback) {
  const path = ref(db, `crews/${crew}/users/${uid}/checks`);
  const unsubscribe = onValue(path, (snap) => callback(snap.val() || {}));
  return unsubscribe;
}

// ✅ 사용자 관련
export function subscribeToUsers(callback) {
  const path = ref(db, "users");
  const unsubscribe = onValue(path, (snap) => callback(snap.val() || {}));
  return unsubscribe;
}

export function updateCrew(uid, newCrew) {
  // crew를 배정/변경할 때, 과거 '미배정 숨김(hiddenUnassigned)' 상태가 남아 있으면
  // 추후 미션 종료/승인 취소 시 미배정 명단에 다시 나타나지 않는 문제가 생길 수 있음.
  // 따라서 crew 변경 시에는 항상 숨김 플래그를 해제하고, 활성 상태로 복구한다.
  const crewRef = ref(db, `users/${uid}/crew`);
  const hiddenRef = ref(db, `users/${uid}/hiddenUnassigned`);
  const statusRef = ref(db, `users/${uid}/status`);
  return Promise.all([
    set(crewRef, newCrew),
    set(hiddenRef, false),
    set(statusRef, 'active'),
  ]);
}

// ✅ 반 배정 해제 (crew 필드 제거)
export function clearUserCrew(uid) {
  // 미배정으로 되돌릴 때도 hiddenUnassigned가 true로 남아 있으면
  // 관리자 미배정 명단에 다시 나타나지 않아서 관리가 불가능해짐.
  // 따라서 crew 해제 시에는 숨김을 해제한다.
  const crewRef = ref(db, `users/${uid}/crew`);
  const hiddenRef = ref(db, `users/${uid}/hiddenUnassigned`);
  const statusRef = ref(db, `users/${uid}/status`);
  return Promise.all([
    set(crewRef, null),
    set(hiddenRef, false),
    // 비활성 사용자라면 상태를 바꾸지 않음
    // (삭제/비활성 처리된 사용자가 자동으로 active로 돌아오는 것을 방지)
    get(statusRef).then((snap) => {
      const cur = snap.val();
      if (cur === 'inactive') return true;
      return set(statusRef, 'active');
    }),
  ]);
}

// ✅ (관리자) 사용자 비활성 처리(소프트 삭제)
// - 계정(문서)은 남기되, 관리자 목록에서 분리해서 관리 가능하도록 함
// - 추후 복구도 가능
export async function deactivateUser(uid) {
  const db2 = getDatabase();
  const userRef = ref(db2, `users/${uid}`);
  const snap = await get(userRef);
  const data = snap.val() || {};
  const updated = {
    ...data,
    crew: null,
    hiddenUnassigned: false,
    status: 'inactive',
    deactivatedAt: Date.now(),
  };
  await set(userRef, updated);
  return { uid, ...updated };
}

// ✅ (관리자) 사용자 복구 (inactive → active)
export async function restoreUser(uid) {
  const db2 = getDatabase();
  const userRef = ref(db2, `users/${uid}`);
  const snap = await get(userRef);
  const data = snap.val() || {};
  const updated = {
    ...data,
    hiddenUnassigned: false,
    status: 'active',
    restoredAt: Date.now(),
  };
  await set(userRef, updated);
  return { uid, ...updated };
}

// ✅ (관리자) 사용자 완전 삭제(하드 삭제)
// 주의: RTDB에서 users/{uid} 및 crews/*/users/{uid} 등 일부 연결 데이터를 제거
// approvals 등 월별 승인 데이터는 남을 수 있으나, 사용자 문서가 없어 관리자 화면에서 자연히 필터링됨
export async function hardDeleteUser(uid) {
  const db2 = getDatabase();
  const tasks = [];
  // users 문서 삭제
  tasks.push(set(ref(db2, `users/${uid}`), null));

  // crews 하위 데이터 정리
  CREW_KEYS.forEach((crew) => {
    tasks.push(set(ref(db2, `crews/${crew}/users/${uid}`), null));
  });

  // 북마크 정리(있을 수 있는 데이터)
  tasks.push(set(ref(db2, `userBookmarks/${uid}`), null));

  await Promise.all(tasks);
  return true;
}

// ✅ (관리자) 전체 사용자 반 배정 해제: 모든 사용자를 미배정 상태로 돌림
export async function adminClearAllUserCrews() {
  const db2 = getDatabase();
  const usersRef = ref(db2, 'users');
  const snap = await get(usersRef);
  const all = snap.val() || {};
  const tasks = [];
  Object.keys(all).forEach((uid) => {
    tasks.push(set(ref(db2, `users/${uid}/crew`), null));
  });
  await Promise.all(tasks);
  return true;
}

// ✅ 소감 관련
export function addComment(crew, payload) {
  const path = ref(db, `comments/${crew}`);
  const itemRef = push(path);
  return set(itemRef, payload);
}

export function updateComment(crew, commentId, patch) {
  if (!crew || !commentId) return Promise.resolve(false);
  const path = ref(db, `comments/${crew}/${commentId}`);
  return update(path, patch || {});
}

export function deleteComment(crew, commentId) {
  if (!crew || !commentId) return Promise.resolve(false);
  const path = ref(db, `comments/${crew}/${commentId}`);
  return set(path, null);
}

export function clearCrewComments(crew) {
  if (!crew) return Promise.resolve(false);
  const path = ref(db, `comments/${crew}`);
  return set(path, null);
}

export function subscribeToCrewComments(crew, callback) {
  const path = ref(db, `comments/${crew}`);
  const unsubscribe = onValue(path, (snap) => {
    const val = snap.val() || {};
    const list = Object.entries(val).map(([id, c]) => ({
      id,
      ...c,
    }));
    list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    // 기본은 충분히 큰 상한(최대 300개)까지만 전달
    // 화면에서 20개/3일 등 필요한 조건으로 필터링한다.
    callback(list.slice(0, 300));
  });
  return unsubscribe;
}

export function subscribeToAllComments(callback) {
  const path = ref(db, "comments");
  const unsubscribe = onValue(path, (snap) => {
    const val = snap.val() || {};
    const merged = [];
    Object.entries(val).forEach(([crew, items]) => {
      Object.entries(items || {}).forEach(([id, c]) => {
        merged.push({
          id: `${crew}_${id}`,
          crew,
          ...c,
        });
      });
    });
    merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    // 홈/더보기 필터링을 위해 충분히 큰 상한(최대 500개)까지만 전달
    callback(merged.slice(0, 500));
  });
  return unsubscribe;
}

// ✅ (관리자) 3일 지난 소감 정리
// - comments/{crew}/{commentId}의 timestamp(ms) 기준
// - cutoff 이전 데이터는 DB에서 영구 삭제(null)
export async function cleanupOldComments(days = 3) {
  const safeDays = Math.max(1, Number(days) || 3);
  const cutoff = Date.now() - safeDays * 24 * 60 * 60 * 1000;
  const db2 = getDatabase();
  const snap = await get(ref(db2, 'comments'));
  const all = snap.val() || {};
  const updates = {};

  Object.entries(all).forEach(([crew, items]) => {
    Object.entries(items || {}).forEach(([id, c]) => {
      const ts = (c && c.timestamp) || 0;
      if (ts && ts < cutoff) {
        updates[`comments/${crew}/${id}`] = null;
      }
    });
  });

  if (Object.keys(updates).length === 0) return { deleted: 0 };
  await update(ref(db2), updates);
  return { deleted: Object.keys(updates).length };
}

export function clearAllComments() {
  const path = ref(db, "comments");
  return set(path, null);
}

// ✅ 전체 크루 체크 데이터 구독 (명예의 전당용)
export function subscribeToAllCrewChecks(callback) {
  const path = ref(db, "crews");
  const unsubscribe = onValue(path, (snap) => callback(snap.val() || {}));
  return unsubscribe;
}

// ✅ 명예의 전당: 월별 데이터 구독
export function subscribeToHallOfFameYear(year, callback) {
  if (!year) return () => { };
  const path = ref(db, `hallOfFame/${year}`);
  const unsubscribe = onValue(path, (snap) => callback(snap.val() || {}));
  return unsubscribe;
}

// 구버전(월별 저장 구조) 호환용: hallOfFame/monthly/{year}
export function subscribeToLegacyMonthlyHallOfFame(year, callback) {
  if (!year) return () => { };
  const path = ref(db, `hallOfFame/monthly/${year}`);
  const unsubscribe = onValue(path, (snap) => callback(snap.val() || {}));
  return unsubscribe;
}

// ✅ 구버전 API 유지(다른 페이지/관리자 기능 호환)
// 기존 코드에서 subscribeToMonthlyHallOfFame(year, cb)를 호출하므로 그대로 제공한다.
export function subscribeToMonthlyHallOfFame(year, callback) {
  return subscribeToLegacyMonthlyHallOfFame(year, callback);
}

// ✅ 월중 메달 현황(숫자) 구독
// monthlyStatus/{year}/{MM}/{gold|silver|bronze} = { challengers, success, fail }
export function subscribeToMonthlyMedalStatus(year, month2, callback) {
  if (!year || !month2) return () => { };
  const path = ref(db, `monthlyStatus/${year}/${month2}`);
  const unsubscribe = onValue(path, (snap) => callback(snap.val() || {}));
  return unsubscribe;
}

// ✅ 명예의 전당: 월 데이터 저장 (금/은/동) - 안전한(중복방지) 버전
export async function saveMonthlyHallOfFame(year, month, ranking) {
  const db2 = getDatabase();
  const monthStr = String(month).padStart(2, '0');
  const ymKey = `${year}-${monthStr}`;

  // 1. 저장할 데이터 구조 준비 (신규/구조 통합)
  const resultsByMedal = { gold: [], silver: [], bronze: [] };
  const legacyPayload = { gold: {}, silver: {}, bronze: {} };

  // 2. 각 사용자별 처리
  const tasks = [];
  for (const u of (ranking || [])) {
    if (!u.medal || !u.uid) continue;

    const medalKey = u.medal; // 'gold' | 'silver' | 'bronze'
    const displayName = u.name || "이름없음";
    const crewName = u.crew || "";

    // 명단에 추가
    resultsByMedal[medalKey].push({ name: displayName, crew: crewName });
    legacyPayload[medalKey][u.uid] = { name: displayName, crew: crewName, chapters: u.chapters || 0 };

    // ✅ 중복 지급 방지 로직 (수정: 반별로 구분하여 지급)
    // 기존: users/{uid}/earnedMedals/{YYYY-MM} -> 반 상관없이 월 1회만 지급됨
    // 변경: users/{uid}/earnedMedals/{YYYY-MM}_{CrewName} -> 반마다 지급 가능
    const awardKey = `${ymKey}_${crewName}`;
    const awardRecordRef = ref(db2, `users/${u.uid}/earnedMedals/${awardKey}`);
    const medalCountRef = ref(db2, `users/${u.uid}/medals/${medalKey}`);

    const awardSnap = await get(awardRecordRef);
    const alreadyAwarded = awardSnap.val();

    if (alreadyAwarded === medalKey) {
      // 이미 이 반에서 같은 메달을 받았다면 카운트 증가 생략
      continue;
    } else if (alreadyAwarded && alreadyAwarded !== medalKey) {
      // 이 반에서 다른 메달을 이미 받았다면 (예: 은->금 승격 등) 교체
      const oldMedalRef = ref(db2, `users/${u.uid}/medals/${alreadyAwarded}`);
      tasks.push((async () => {
        const oldSnap = await get(oldMedalRef);
        const nextSnap = await get(medalCountRef);
        await set(oldMedalRef, Math.max(0, (oldSnap.val() || 0) - 1));
        await set(medalCountRef, (nextSnap.val() || 0) + 1);
        await set(awardRecordRef, medalKey);
      })());
    } else {
      // 처음 받는 경우면 카운트 +1
      tasks.push((async () => {
        const curSnap = await get(medalCountRef);
        await set(medalCountRef, (curSnap.val() || 0) + 1);
        await set(awardRecordRef, medalKey);
      })());
    }
  }

  // 3. DB 실제 저장 (경로 통합)
  // 신규 경로: hallOfFame/{year}/monthlyResults/{month}/{medal}
  for (const medal of ['gold', 'silver', 'bronze']) {
    tasks.push(set(ref(db2, `hallOfFame/${year}/monthlyResults/${monthStr}/${medal}`), resultsByMedal[medal]));
  }
  // 구버전 경로 호환성 유지: hallOfFame/monthly/{year}/{month}
  tasks.push(set(ref(db2, `hallOfFame/monthly/${year}/${month}`), legacyPayload));

  await Promise.all(tasks);
  return true;
}



// ✅ 명예의 전당 수동 수정: 특정 연/월/사용자의 메달 조정 (월별 + 개인 메달 동기화)
export async function adminSetMonthlyUserMedal(year, month, uid, medalType, crewName) {
  if (!year || !month || !uid || !crewName) return false;
  const db = getDatabase();
  const mm = String(month).padStart(2, '0');
  const ymKey = `${year}-${mm}`;
  const awardKey = `${ymKey}_${crewName}`;

  // 0. 월별 결과 보고서(monthlyReports) 동기화 준비
  const reportRef = ref(db, `monthlyReports/${ymKey}`);
  const reportSnap = await get(reportRef);
  const reportData = reportSnap.val() || null;

  // 1. 레거시(monthly) 데이터 로드 및 수정
  const legacyRef = ref(db, `hallOfFame/monthly/${year}/${month}`);
  const legacySnap = await get(legacyRef);
  const legacyData = legacySnap.val() || { gold: {}, silver: {}, bronze: {} };

  // 2. 신규 구조(hofYear) 데이터 로드 및 수정
  const hofYearRef = ref(db, `hallOfFame/${year}/monthlyResults/${mm}`);
  const hofYearSnap = await get(hofYearRef);
  const hofYearData = hofYearSnap.val() || { gold: [], silver: [], bronze: [] };

  const buckets = ['gold', 'silver', 'bronze'];

  // 3. 해당 사용자의 이 '반'에서의 기존 메달 기록 확인 (중복 지급 방지 및 증빙용)
  const awardRecordRef = ref(db, `users/${uid}/earnedMedals/${awardKey}`);
  const awardSnap = await get(awardRecordRef);
  const previousType = awardSnap.val(); // 이전에 이 반에서 받은 메달 종류

  let userName = uid;
  const userSnap = await get(ref(db, `users/${uid}`));
  const user = userSnap.val() || {};
  userName = user.name || uid;

  // 4. 명예의 전당 명단(Hall of Fame)에서 기존 기록 제거
  buckets.forEach((type) => {
    // 레거시 제거 (UID 기준)
    if (legacyData[type] && legacyData[type][uid]) {
      // 단, 수동 수정 시에는 '반' 이름이 일치할 때만 지워야 함 (레거시는 반 이름 정보가 부족할 수 있음)
      if (legacyData[type][uid].crew === crewName) {
        delete legacyData[type][uid];
      }
    }

    // 신규 구조 제거 (이름 + 반 기준)
    if (Array.isArray(hofYearData[type])) {
      hofYearData[type] = hofYearData[type].filter(item => {
        const iName = typeof item === 'object' ? item.name : item;
        const iCrew = typeof item === 'object' ? item.crew : '';
        return !(iName === userName && iCrew === crewName);
      });
    }
  });

  // 5. 새 메달 타입이 있다면 명예의 전당 명단에 추가
  if (medalType && medalType !== 'none') {
    // 레거시 추가
    if (!legacyData[medalType]) legacyData[medalType] = {};
    legacyData[medalType][uid] = {
      name: userName,
      crew: crewName,
      chapters: 0,
    };

    // 신규 구조 추가
    if (!Array.isArray(hofYearData[medalType])) hofYearData[medalType] = [];
    hofYearData[medalType].push({
      name: userName,
      crew: crewName
    });
  }

  const tasks = [];

  // 6. 개인 메달 총 개수(Counter) 조정
  // 이전 메달 -1
  if (previousType && buckets.includes(previousType)) {
    const prevRef = ref(db, `users/${uid}/medals/${previousType}`);
    tasks.push(
      get(prevRef).then((s) => {
        const current = s.val() || 0;
        return set(prevRef, Math.max(0, current - 1));
      })
    );
  }

  // 새 메달 +1
  if (medalType && medalType !== 'none' && buckets.includes(medalType)) {
    const nextRef = ref(db, `users/${uid}/medals/${medalType}`);
    tasks.push(
      get(nextRef).then((s) => {
        const current = s.val() || 0;
        return set(nextRef, current + 1);
      })
    );
    // earnedMedals 영수증 기록
    tasks.push(set(awardRecordRef, medalType));
  } else if (medalType === 'none') {
    // 메달 삭제 시 영수증도 삭제
    tasks.push(set(awardRecordRef, null));
  }

  // 7. DB 최종 저장
  tasks.push(set(legacyRef, legacyData));
  tasks.push(set(hofYearRef, hofYearData));

  // 8. 월별 결과 보고서(monthlyReports)가 있다면 함께 수정하여 일관성 유지
  if (reportData && reportData[uid]) {
    const isAdding = medalType && medalType !== 'none';
    const updatedUserReport = {
      ...reportData[uid],
      stateLabel: isAdding ? '성공' : '실패'
    };

    // 가능하면 전체 메달 개수도 즉시 반영 (낙관적 업데이트)
    if (user.medals) {
      const m = { ...user.medals };
      if (previousType && m[previousType] > 0) m[previousType]--;
      if (isAdding) m[medalType] = (m[medalType] || 0) + 1;
      updatedUserReport.totalMedals = (m.gold || 0) + (m.silver || 0) + (m.bronze || 0);
    }

    tasks.push(set(ref(db, `monthlyReports/${ymKey}/${uid}`), updatedUserReport));
  }

  await Promise.all(tasks);
  return true;
}



// ✅ 반별 승인 관리 (월별)

// 현재 연-월 키 (예: "2025-11")
export function getCurrentYMKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// 다음 달 연-월 키 (예: "2025-12")
export function getNextYMKey() {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 2; // 다음 달

  if (month > 12) {
    year += 1;
    month = 1;
  }

  const m = String(month).padStart(2, '0');
  return `${year}-${m}`;
}

// 이번 달 특정 반 승인 목록 구독
export function subscribeToCrewApprovals(crew, ymKey, callback) {
  const path = ref(db, `approvals/${ymKey}/${crew}`);
  const unsubscribe = onValue(path, (snap) => {
    callback(snap.val() || {});
  });
  return unsubscribe;
}

// 이름(UID) 승인 추가
export function addCrewApprovalName(crew, ymKey, name) {
  const key = (name || '').trim();
  if (!key) return Promise.resolve();
  const path = ref(db, `approvals/${ymKey}/${crew}/${key}`);
  return set(path, true);
}



// 이름 정규화 (앞쪽 콤마/공백 제거, 양끝 공백 제거)
export function normalizeNameForKey(name) {
  return (name || '')
    .toString()
    .trim()
    .replace(/^[,，\s]+/, '')
    .replace(/\s+/g, '');
}

// 여러 이름(띄어쓰기/줄바꿈 구분)을 한 번에 승인 추가
export async function addCrewApprovalNames(crew, ymKey, namesInput) {
  const raw = Array.isArray(namesInput) ? namesInput.join(' ') : (namesInput || '');
  const names = raw
    .split(/\s+/)
    .map((n) => normalizeNameForKey(n))
    .filter(Boolean);

  if (names.length === 0) return [];

  const updates = {};
  names.forEach((n) => {
    updates[`approvals/${ymKey}/${crew}/${n}`] = true;
  });

  await update(ref(db), updates);
  return names;
}

// ✅ 수동 승인 + 히스토리 동시 저장 (이름/UID 기반)
export async function addManualApprovalWithHistory(crew, ymKey, userList) {
  if (!userList || userList.length === 0) return;
  const db = getDatabase();
  const updates = {};

  userList.forEach((u) => {
    const cleanName = normalizeNameForKey(u.name);
    if (!cleanName) return;

    // 1. 승인 목록 (이름 기반)
    updates[`approvals/${ymKey}/${crew}/${cleanName}`] = true;

    // 2. 신청 기록 (UID 기반) 및 사용자 프로필 동기화
    if (u.uid) {
      updates[`applicationHistory/${ymKey}/${u.uid}/${crew}`] = {
        name: u.name,
        crew,
        ymKey,
        createdAt: Date.now(),
        method: 'manual_approval_immediate',
      };
      // ✅ [추가] 수동 추가 시에도 사용자 소속(crew) 정보를 즉시 업데이트
      updates[`users/${u.uid}/crew`] = crew;
      updates[`users/${u.uid}/hiddenUnassigned`] = false;
      updates[`users/${u.uid}/status`] = 'active';
    }
  });

  return update(ref(db), updates);
}




// 해당 반 이번 달 승인 전체 삭제
export function clearCrewApprovals(crew, ymKey) {
  const path = ref(db, `approvals/${ymKey}/${crew}`);
  return set(path, null);
}

// 특정 사용자 승인 여부 실시간 구독
export function subscribeToUserApproval(crew, ymKey, uid, callback) {
  const path = ref(db, `approvals/${ymKey}/${crew}/${uid}`);
  const unsubscribe = onValue(path, (snap) => {
    callback(!!snap.val());
  });
  return unsubscribe;
}


// ✅ 사용자 로그인 & 비밀번호 관리


export async function loginOrRegisterUser(name, password) {
  // ✅ 이름 유효성 검사: 한글 또는 영문만 허용 (공백, 숫자, 특수문자 불가)
  const nameRegex = /^[가-힣a-zA-Z]+$/;
  if (!name || !nameRegex.test(name)) {
    const err = new Error('이름은 한글 또는 영문자만 입력 가능합니다. (공백, 숫자, 특수문자 불가)');
    err.code = 'INVALID_NAME';
    throw err;
  }

  const db = getDatabase();
  const uid = name; // 현재 구조에서는 이름을 UID로 사용
  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);
  let userData = snap.val();

  // 입력된 비밀번호 전처리
  const rawPassword = password != null ? String(password) : '';
  const trimmedPassword = rawPassword.trim();

  // 최초 로그인: 사용자 정보가 없으면 생성 (비밀번호 필수)
  if (!userData) {
    if (!trimmedPassword) {
      const err = new Error('최초 로그인 시에는 비밀번호를 입력해야 합니다.');
      err.code = 'EMPTY_PASSWORD';
      throw err;
    }

    const newUser = {
      name,
      password: trimmedPassword,
      crew: null,
      status: 'active',
      hiddenUnassigned: false,
      mustChangePassword: false,
      createdAt: Date.now(),
    };
    await set(userRef, newUser);
    return { uid, ...newUser };
  }

  // 기존 사용자: 비밀번호가 이미 저장된 경우 검증
  if (userData.password) {
    if (userData.password !== rawPassword && userData.password !== trimmedPassword) {
      const err = new Error('비밀번호가 올바르지 않습니다.');
      err.code = 'WRONG_PASSWORD';
      throw err;
    }
  } else {
    // 예전 데이터: 비밀번호가 없던 사용자는 이번에 설정 (비밀번호 필수)
    if (!trimmedPassword) {
      const err = new Error('비밀번호를 설정해야 합니다.');
      err.code = 'EMPTY_PASSWORD';
      throw err;
    }
    userData.password = trimmedPassword;
    userData.mustChangePassword = false;
    await set(userRef, userData);
  }

  return { uid, ...userData };
}

// 관리자에 의한 사용자 비밀번호 초기화 (0000 + mustChangePassword=true)
export async function resetUserPassword(uid) {
  const db = getDatabase();
  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);
  const data = snap.val() || {};
  const updated = {
    ...data,
    password: '0000',
    mustChangePassword: true,
  };
  await set(userRef, updated);
  return { uid, ...updated };
}

// 사용자가 스스로 비밀번호 변경
export async function updateUserPassword(uid, newPassword) {
  const db = getDatabase();
  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);
  const data = snap.val() || {};
  const updated = {
    ...data,
    password: newPassword,
    mustChangePassword: false,
  };
  await set(userRef, updated);
  return { uid, ...updated };
}

// ✅ 관리자 비밀번호 & 마스터 비밀번호(8395)

const ADMIN_MASTER_PASSWORD = '8395';

export async function verifyAdminPassword(inputPassword) {
  // 마스터 비밀번호는 항상 허용
  if (inputPassword === ADMIN_MASTER_PASSWORD) {
    return { ok: true, usedMaster: true };
  }

  const db = getDatabase();
  const pwdRef = ref(db, '/admin/password');
  const snap = await get(pwdRef);
  const saved = snap.val();

  // 아직 설정된 관리자 비밀번호가 없다면 기본값 1234 사용
  const effective = saved || '1234';

  if (inputPassword === effective) {
    return { ok: true, usedMaster: false };
  }

  const err = new Error('관리자 비밀번호가 올바르지 않습니다.');
  err.code = 'WRONG_ADMIN_PASSWORD';
  throw err;
}

export async function updateAdminPassword(newPassword) {
  const db = getDatabase();
  const pwdRef = ref(db, '/admin/password');
  await set(pwdRef, newPassword);
  return true;
}

// ✅ [안전 추가] 사용자 관리자 권한 부여/해제 (DB 구조 변경 없음, 필드만 추가)
export async function setAdminStatus(uid, isAdmin) {
  if (!uid) return false;
  const db2 = getDatabase();
  // isAdmin 필드만 업데이트 (기존 데이터 보존)
  await update(ref(db2, `users/${uid}`), { isAdmin: !!isAdmin });
  return true;
}


// ✅ 다음 달 크루 신청 관리

// 다음 달 크루 신청 저장

// [사용자용] 다음 달 크루 신청 (기존 내역 덮어쓰기 = 하나만 유지)
export async function overwriteNextMonthApplication(crew, uid, name) {
  if (!crew || !uid) return;

  // 1. 기존 내역 전체 취소
  await cancelNextMonthApplication(uid, null); // null = 전체 취소

  // 2. 새로운 내역 저장
  return saveNextMonthApplication(crew, uid, name);
}

// 다음 달 크루 신청 저장 (중복 신청 허용 - 관리자용/추가용)
export function saveNextMonthApplication(crew, uid, name) {
  if (!crew || !uid) return Promise.resolve();
  const db = getDatabase();
  const ymKey = getNextYMKey();

  const base = {
    name: name || '',
    crew,
    ymKey,
    createdAt: Date.now(),
  };

  const byCrewRef = ref(db, `/nextMonthApplications/${ymKey}/${crew}/${uid}`);
  // 사용자별 신청 목록 (여러 반 가능하므로 crew를 키로 사용)
  const byUserRef = ref(db, `/nextMonthApplicationsByUser/${ymKey}/${uid}/${crew}`);

  // ✅ 누적 신청 기록용 (승인되어도 삭제하지 않음 - 역시 crew 키로 분리하거나 로그성으로 저장)
  // 여기서는 덮어쓰기보다는 로그성으로 남기는게 좋겠지만, 기존 호환성을 위해 
  // applicationHistory/{ymKey}/{uid}/{crew} 구조로 저장하는 것이 안전함.
  const historyRef = ref(db, `/applicationHistory/${ymKey}/${uid}/${crew}`);

  // ✅ 자동 승인: 신청 즉시 승인 목록에도 추가
  const cleanName = normalizeNameForKey(name);
  const approvalRef = ref(db, `/approvals/${ymKey}/${crew}/${cleanName}`);

  return Promise.all([
    set(byCrewRef, base),
    set(byUserRef, base),
    set(historyRef, base),
    cleanName ? set(approvalRef, true) : Promise.resolve(), // 승인 처리
  ]);
}

// 현재 로그인한 사용자의 다음 달 신청 내역 구독

export function subscribeToMyNextMonthApplication(uid, callback) {
  if (!uid) {
    callback(null);
    return () => { };
  }
  const db = getDatabase();
  const ymKey = getNextYMKey();
  const r = ref(db, `/nextMonthApplicationsByUser/${ymKey}/${uid}`);
  return onValue(r, (snap) => {
    callback(snap.val() || null);
  });
}



// 다음 달 크루 신청 취소 (특정 반 지정 가능)
export function cancelNextMonthApplication(uid, targetCrew = null) {
  if (!uid) return Promise.resolve();
  const db = getDatabase();
  const ymKey = getNextYMKey();

  // 1. 특정 반만 취소하는 경우
  if (targetCrew) {
    const byCrewRef = ref(db, `/nextMonthApplications/${ymKey}/${targetCrew}/${uid}`);
    const byUserCrewRef = ref(db, `/nextMonthApplicationsByUser/${ymKey}/${uid}/${targetCrew}`);

    // 히스토리에서도 삭제할지 여부는 정책 나름이나, 신청 취소이므로 히스토리도 지우는게 깔끔함.
    // 다만 saveNextMonthApplication에서 히스토리를 `{uid}/{crew}`로 저장하도록 바꿨으므로 여기서도 그렇게 지움.
    const historyRef = ref(db, `/applicationHistory/${ymKey}/${uid}/${targetCrew}`);

    // ✅ 승인 목록에서도 삭제해야 함 (이름을 알아야 함)
    // 이름을 알기 위해 먼저 application을 읽어야 함.
    return get(byUserCrewRef).then((snap) => {
      const val = snap.val();
      const name = val ? val.name : '';
      const cleanName = normalizeNameForKey(name);
      const approvalRef = ref(db, `/approvals/${ymKey}/${targetCrew}/${cleanName}`);

      return Promise.all([
        set(byCrewRef, null),
        set(byUserCrewRef, null),
        set(historyRef, null),
        cleanName ? set(approvalRef, null) : Promise.resolve(),
      ]);
    });
  }

  // 2. 전체 취소 (기존 호환성 및 일괄 취소)
  // 사용자 기준 노드 전체 삭제
  const byUserRootRef = ref(db, `/nextMonthApplicationsByUser/${ymKey}/${uid}`);

  // 반별 노드 삭제를 위해 전체 검색 필요 (비효율적일 수 있으나 정확성 위해)
  // 또는 byUserRootRef를 읽어서 신청한 반 목록을 확인 후 삭제
  return get(byUserRootRef).then((snap) => {
    const val = snap.val() || {}; // { 고급반: {...}, 초급반: {...} }
    const tasks = [];

    // 사용자 루트 삭제
    tasks.push(set(byUserRootRef, null));

    // 각 반별 삭제
    Object.keys(val).forEach((crewKey) => {
      const byCrewRef = ref(db, `/nextMonthApplications/${ymKey}/${crewKey}/${uid}`);
      const historyRef = ref(db, `/applicationHistory/${ymKey}/${uid}/${crewKey}`);

      // ✅ 승인 목록에서도 삭제
      const name = val[crewKey] ? val[crewKey].name : '';
      const cleanName = normalizeNameForKey(name);
      if (cleanName) {
        const approvalRef = ref(db, `/approvals/${ymKey}/${crewKey}/${cleanName}`);
        tasks.push(set(approvalRef, null));
      }

      tasks.push(set(byCrewRef, null));
      tasks.push(set(historyRef, null));
    });

    return Promise.all(tasks);
  });
}

// ✅ [Legacy Support] 다음 달 전체 신청자 목록(반별) 구독 (구버전 호환용)
export function subscribeToNextMonthApplications(callback) {
  const db = getDatabase();
  const ymKey = getNextYMKey();
  const r = ref(db, `/nextMonthApplications/${ymKey}`);
  return onValue(r, (snap) => {
    callback(snap.val() || {});
  });
}

// ✅ [Legacy Support] 구버전 신청자 일괄 승인 처리
export async function approveAllNextMonthApplicants(ymKey, crew) {
  if (!ymKey || !crew) return { approved: [], skipped: [] };
  const db = getDatabase();

  const snap = await get(ref(db, `nextMonthApplications/${ymKey}/${crew}`));
  const applicants = snap.val() || {};

  const updates = {};
  const approved = [];
  const skipped = [];

  Object.entries(applicants).forEach(([key, obj]) => {
    const cleanName = normalizeNameForKey(obj?.name ?? key);
    if (!cleanName) {
      skipped.push(key);
      return;
    }
    updates[`approvals/${ymKey}/${crew}/${cleanName}`] = true;
    updates[`nextMonthApplications/${ymKey}/${crew}/${key}`] = null;
    approved.push(cleanName);
  });

  if (Object.keys(updates).length === 0) return { approved: [], skipped };

  await update(ref(db), updates);
  return { approved, skipped };
}




// 최근 N개월(nextMonthApplications) 키 조회 및 정리 (관리자용)
// - limit 개수만 남기고 오래된 달은 삭제
export async function getRecentApplicationMonths(limit = 3) {
  const db = getDatabase();
  const rootRef = ref(db, '/applicationHistory');
  const snap = await get(rootRef);
  const val = snap.val() || {};
  const keys = Object.keys(val)
    .filter((k) => /^\d{4}-\d{2}$/.test(k))
    .sort(); // 오름차순 (가장 오래된 달이 앞)

  if (keys.length === 0) {
    return [];
  }

  const keepCount = Math.max(1, limit || 1);
  const toRemoveCount = Math.max(0, keys.length - keepCount);
  const toRemove = keys.slice(0, toRemoveCount);
  const toKeep = keys.slice(toRemoveCount); // 최신 keepCount 개

  const tasks = [];
  toRemove.forEach((ymKey) => {
    const byCrewRef = ref(db, `/nextMonthApplications/${ymKey}`);
    const byUserRef = ref(db, `/nextMonthApplicationsByUser/${ymKey}`);
    tasks.push(set(byCrewRef, null));
    tasks.push(set(byUserRef, null));
  });

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }

  // 최신 달이 앞에 오도록 내림차순 정렬 반환
  return toKeep.sort().reverse();
}

// 특정 연-월(YYYY-MM)의 신청자 전체 데이터를 불러오기 (누적 히스토리 기준)
// ✅ 반 배정 적용 및 히스토리 저장
export async function applyMonthlyAssignments(ymKey, approvalLists) {
  const db = getDatabase();
  const updates = {};
  const timestamp = Date.now();

  // 1. 사용자 정보 업데이트 (모든 반 순회)
  for (const [crew, uids] of Object.entries(approvalLists)) {
    if (!uids || !Array.isArray(uids)) continue;
    uids.forEach(uid => {
      updates[`users/${uid}/crew`] = crew;
      updates[`users/${uid}/hiddenUnassigned`] = false;
      updates[`users/${uid}/status`] = 'active';
    });
  }

  // 2. 5번 섹션을 위한 기초 스냅샷 저장 (비교용)
  updates[`applicationHistory/${ymKey}/snapshot`] = approvalLists;
  updates[`applicationHistory/${ymKey}/appliedAt`] = timestamp;

  await update(ref(db), updates);
  return true;
}

// 배정 완료 여부 확인
export function subscribeToAssignmentStatus(ymKey, callback) {
  const db = getDatabase();
  const r = ref(db, `/applicationHistory/${ymKey}/appliedAt`);
  return onValue(r, (snap) => callback(snap.val() || null));
}

// 스냅샷 불러오기 (5번 섹션용)
export async function fetchAssignmentSnapshot(ymKey) {
  const db = getDatabase();
  const snap = await get(ref(db, `/applicationHistory/${ymKey}/snapshot`));
  return snap.val() || {};
}

export async function fetchApplicationsByMonth(ymKey) {
  if (!ymKey) return {};
  const db = getDatabase();
  // ✅ snapshot을 우선 조회 (새로운 로직)
  const snap = await get(ref(db, `/applicationHistory/${ymKey}/snapshot`));
  if (snap.exists()) return snap.val();

  // 없으면 구버전(uid 기반) 조회
  const rootRef = ref(db, `/applicationHistory/${ymKey}`);
  const snapLegacy = await get(rootRef);
  return snapLegacy.val() || {};
}

// ✅ 공지 관리 (항상 1개만 유지)

export function subscribeToNotice(callback) {
  const db = getDatabase();
  const r = ref(db, '/notice');
  return onValue(r, (snap) => callback(snap.val() || null));
}

export function saveNotice(title, content) {
  const db = getDatabase();
  const r = ref(db, '/notice');
  const payload = {
    title: title || '',
    content: content || '',
    timestamp: Date.now(),
  };
  return set(r, payload);
}


// 사용자 메달 누적 구독
export function subscribeToUserMedals(uid, callback) {
  if (!uid) {
    callback({});
    return () => { };
  }
  const db = getDatabase();
  const r = ref(db, `/users/${uid}/medals`);
  return onValue(r, (snap) => {
    callback(snap.val() || {});
  });
}



// ✅ 반 승인 모드 저장/조회
export function saveCrewApprovalMode(crew, mode) {
  const db = getDatabase();
  return set(ref(db, `/settings/approval/${crew}`), mode);
}

export function subscribeToCrewApprovalModes(callback) {
  const db = getDatabase();
  const r = ref(db, '/settings/approval');
  return onValue(r, snap => callback(snap.val() || {}));
}


// SETTINGS

export function subscribeToSettings(callback) {
  const db = getDatabase();
  const r = ref(db, '/settings');
  return onValue(r, snap => callback(snap.val() || {}));
}
export function saveChurchName(name) {
  const db = getDatabase();
  return set(ref(db, '/settings/churchName'), name);
}
export function saveAppDescription(text) {
  const db = getDatabase();
  return set(ref(db, '/settings/appDescription'), text);
}

export function saveBulletinUrl(url) {
  const db = getDatabase();
  return set(ref(db, '/settings/bulletinUrl'), url || '');
}

// 미배정 명단에서 특정 사용자를 숨기기 (계정은 유지, 미배정 리스트에서만 제외)
export async function removeUnassignedUser(uid) {
  const db = getDatabase();
  const userRef = ref(db, `users/${uid}`);
  const snap = await get(userRef);
  const data = snap.val() || {};
  const updated = {
    ...data,
    hiddenUnassigned: true,
  };
  await set(userRef, updated);
  return { uid, ...updated };
}


// ---- Bookmark functions (corrected RTDB) ----
export function saveLastBibleBookmark(uid, bookmark) {
  if (!uid) return Promise.resolve();
  const path = ref(db, `userBookmarks/${uid}`);
  return set(path, {
    bookId: bookmark.bookId,
    chapter: bookmark.chapter,
    updatedAt: Date.now()
  });
}

export function subscribeToLastBibleBookmark(uid, callback) {
  if (!uid) {
    callback(null);
    return () => { };
  }
  const path = ref(db, `userBookmarks/${uid}`);
  const unsub = onValue(path, snap => {
    callback(snap.val() || null);
  }, err => callback(null));
  return () => unsub();
}

// ✅ 월별 결과 보고서 저장
export async function saveMonthlyReport(year, month, reportData) {
  const db2 = getDatabase();
  const path = ref(db2, `monthlyReports/${year}-${String(month).padStart(2, '0')}`);
  await set(path, reportData);
  return true;
}

// ✅ 월별 결과 보고서 조회 (연-월 목록)
export async function getMonthlyReportMonths() {
  const db2 = getDatabase();
  const r = ref(db2, 'monthlyReports');
  const snap = await get(r);
  const val = snap.val() || {};
  return Object.keys(val).sort().reverse();
}

// ✅ 특정 월 보고서 데이터 가져오기
export async function fetchMonthlyReport(ymKey) {
  const db2 = getDatabase();
  const r = ref(db2, `monthlyReports/${ymKey}`);
  const snap = await get(r);
  return snap.val() || {};
}
// ✅ 특정 연도의 모든 월별 데이터 가져오기 (명예의 전당 기준)
export async function getYearlyHallOfFame(year) {
  const db2 = getDatabase();
  const r = ref(db2, `hallOfFame/${year}/monthlyResults`);
  const snap = await get(r);
  return snap.val() || {};
}
