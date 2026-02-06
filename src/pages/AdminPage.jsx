import { saveChurchName, saveAppDescription, saveBulletinUrl, subscribeToSettings } from '../firebaseSync';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase'; // Import db directly
import { ref, get } from 'firebase/database'; // Import firebase SDK

import { CREWS, CREW_KEYS, getCrewLabel } from '../utils/crewConfig';
import {
  subscribeToUsers,
  updateCrew,
  loadUserChecks,
  saveCrewCheck,
  clearAllComments,
  clearCrewComments,
  cleanupOldComments,
  subscribeToAllCrewChecks,
  subscribeToMonthlyHallOfFame,
  saveMonthlyHallOfFame,
  getCurrentYMKey,
  subscribeToCrewApprovals, // Restored
  getNextYMKey, // Restored
  resetUserPassword, // Restored
  updateAdminPassword, // Restored
  subscribeToNotice,
  saveNotice,
  subscribeToNextMonthApplications, // Restored for legacy
  approveAllNextMonthApplicants, // Restored for legacy
  normalizeNameForKey, // ✅ Added
  getRecentApplicationMonths,
  fetchApplicationsByMonth,
  adminSetMonthlyUserMedal,
  deactivateUser,
  restoreUser,
  hardDeleteUser,
  saveCrewApprovalMode,
  subscribeToCrewApprovalModes,
  saveMonthlyReport,
  getMonthlyReportMonths,
  fetchMonthlyReport,
  getYearlyHallOfFame,
  saveNextMonthApplication,
  cancelNextMonthApplication, // ✅ 취소 함수 추가
  addManualApprovalWithHistory, // ✅ 히스토리 포함 수동 승인
  clearCrewApprovals, // ✅ Added missing import
  setAdminStatus, // 추가
  applyMonthlyAssignments, // 추가
  subscribeToAssignmentStatus, // 추가
  fetchAssignmentSnapshot, // 추가
  runMedalFixOps, // ✅ Added Fix Ops Function Import (Will execute fix logic with auth)
} from '../firebaseSync';

import { calculateMonthlyRankingForMonth } from '../utils/rankingUtils';
import { getMonthDates } from '../utils/dateUtils';
import { getDailyBiblePortionByCrew } from '../utils/bibleUtils';
import { getTodayCrewState } from '../utils/crewStatusUtils';
import { calculateDokStatus } from '../utils/dokUtils';

export default function AdminPage({ user }) {
  const navigate = useNavigate();

  // ✅ 보안 강화: 관리자 권한 체크 (비밀번호 로그인 없이 온 경우 대비)
  useEffect(() => {
    // 1. 유저 정보가 없거나 관리자가 아닌 경우
    if (!user || !user.isAdmin) {
      // 2. 관리자 로그인 페이지로 안내 (비밀번호가 최후의 수단)
      // 단, 비밀번호를 막 치고 들어온 직후를 위해 약간의 유예를 두거나 
      // 현재는 간단히 알림 후 이동 처리
      console.warn('관리자 권한이 없습니다. 로그인 페이지로 이동합니다.');
      navigate('/admin-login');
    }
  }, [user, navigate]);
  const [users, setUsers] = useState({});
  const [crews, setCrews] = useState({});
  const [crewStatus, setCrewStatus] = useState(() => {
    const init = {};
    CREW_KEYS.forEach((c) => (init[c] = []));
    return init;
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [checks, setChecks] = useState({});
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [lastYM, setLastYM] = useState({ year: null, month: null });
  const [settings, setSettings] = useState({});
  const [churchNameInput, setChurchNameInput] = useState('');
  const [appDescriptionInput, setAppDescriptionInput] = useState('');
  const [bulletinUrlInput, setBulletinUrlInput] = useState('');

  const [approvalInput, setApprovalInput] = useState({
    고급반: '',
    중급반: '',
    초급반: '',
  });
  const [approvalModes, setApprovalModes] = useState({ 고급반: 'manual', 중급반: 'manual', 초급반: 'manual' });
  const [approvalLists, setApprovalLists] = useState({
    고급반: [],
    중급반: [],
    초급반: [],
  });
  const [nextApprovalLists, setNextApprovalLists] = useState({
    고급반: [],
    중급반: [],
    초급반: [],
  });
  const [nextMonthApps, setNextMonthApps] = useState({}); // Legacy support
  const [historyMonths, setHistoryMonths] = useState([]);
  const [selectedHistoryMonth, setSelectedHistoryMonth] = useState('');
  const [historyApps, setHistoryApps] = useState({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const [manualHoFName, setManualHoFName] = useState('');
  const [manualHoFYear, setManualHoFYear] = useState(new Date().getFullYear());
  const [manualHoFMonth, setManualHoFMonth] = useState(new Date().getMonth() + 1);
  const [manualHoFCrew, setManualHoFCrew] = useState(''); // ✅ 추가
  const [manualHoFMedal, setManualHoFMedal] = useState('gold');
  const [manualHoFLoading, setManualHoFLoading] = useState(false);

  // ✅ [10] 사용자 체크 강제 관리용 상태
  const [adminCalYear, setAdminCalYear] = useState(new Date().getFullYear());
  const [adminCalMonth, setAdminCalMonth] = useState(new Date().getMonth() + 1);
  const [adminCalCrew, setAdminCalCrew] = useState('');
  const [adminCalChecks, setAdminCalChecks] = useState({});
  const adminCheckUnsubRef = useRef(null);
  const [adminCalSearchTerm, setAdminCalSearchTerm] = useState(''); // ✅ 이름 검색어 추가

  const ymKey = getCurrentYMKey();
  const nextYmKey = getNextYMKey();

  const [reportMonths, setReportMonths] = useState([]);
  const [selectedReportYM, setSelectedReportYM] = useState('');
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // 수동 배정 상태
  const [manualEnrollName, setManualEnrollName] = useState('');
  const [manualEnrollCrew, setManualEnrollCrew] = useState('');

  const [yearlyData, setYearlyData] = useState([]);
  const [yearlyLoading, setYearlyLoading] = useState(false);
  const [yearlyFilter, setYearlyFilter] = useState('all'); // all, full, advanced, intermediate...

  const [selectedYearForReport, setSelectedYearForReport] = useState(new Date().getFullYear());
  const [showMonthlyArchive, setShowMonthlyArchive] = useState(false);
  const [showYearlyReport, setShowYearlyReport] = useState(false);
  const [showCrewStatus, setShowCrewStatus] = useState(false);
  const [showUnassignedUsers, setShowUnassignedUsers] = useState(false);
  const [appliedAt, setAppliedAt] = useState(null); // 이번 달 배정 적용 시간
  const [startMonthLoading, setStartMonthLoading] = useState(false);
  const [currentSnapshot, setCurrentSnapshot] = useState({}); // 배정 확정 시점 스냅샷
  const [activeTab, setActiveTab] = useState('group1'); // [추가] 탭 상태: group1, group2, group3, group4

  const checksUnsubRef = useRef(null);

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const dates = getMonthDates(year, month);
    if (!dates || dates.length === 0) {
      const empty = {};
      CREW_KEYS.forEach((c) => (empty[c] = []));
      setCrewStatus(empty);
      return;
    }
    const today = now.getDate();
    const uptoDates = dates.slice(0, today);
    const todayKey = `${year}-${String(month).padStart(2, '0')}-${String(today).padStart(2, '0')}`;
    const crewNames = CREW_KEYS;
    const portionByCrewAndDate = {};
    crewNames.forEach((crew) => {
      const portions = getDailyBiblePortionByCrew(crew, dates);
      const map = {};
      portions.forEach((p) => {
        map[p.date] = p;
      });
      portionByCrewAndDate[crew] = map;
    });
    const status = {};
    crewNames.forEach((c) => {
      status[c] = [];
    });

    // 1. 자동 동기화 & 명단 집계 (승인 명단 <-> DB crew 동기화)
    const combinedStatus = {};
    CREW_KEYS.forEach((c) => (combinedStatus[c] = []));

    // 중복 방지를 위한 Set
    const processedUids = new Set();

    // (1) 승인 명단(approvalLists) 기준 순회 -> "승인된 사람은 무조건 해당 반 소속이어야 함"
    CREW_KEYS.forEach((crew) => {
      const approvedUids = approvalLists[crew] || [];
      approvedUids.forEach((uid) => {
        const userInfo = users[uid];
        // ✅ [수정] 자동 동기화 제거 (관리자가 버튼 누를 때만 업데이트됨)
        /*
        if (userInfo && userInfo.crew !== crew) {
          updateCrew(uid, crew);
        }
        */

        // 리스트에 추가
        processedUids.add(uid); // 처리됨 표시
        addToStatusList(crew, uid, users, crews, portionByCrewAndDate, uptoDates, dates, todayKey, combinedStatus);
      });
    });

    // (2) DB crew 기준 순회 -> "승인 명단엔 없어도, 소속이 되어 있는 사람도 표시" (기존 배정자 등)
    Object.entries(users || {}).forEach(([uid, info]) => {
      if (processedUids.has(uid)) return; // 이미 위에서 처리된 사람은 패스

      const userCrew = info.crew;
      if (userCrew && CREW_KEYS.includes(userCrew)) {
        // 이 사람은 승인명단엔 없지만, crew정보가 살아있으므로 표시
        addToStatusList(userCrew, uid, users, crews, portionByCrewAndDate, uptoDates, dates, todayKey, combinedStatus);
      }
    });

    // 정렬
    Object.keys(combinedStatus).forEach((crew) => {
      combinedStatus[crew].sort((a, b) => b.chapters - a.chapters);
    });
    setCrewStatus(combinedStatus);
  }, [crews, users, approvalLists]);

  // 헬퍼 함수: 상태 리스트에 항목 추가
  function addToStatusList(crew, uid, users, crews, portionByCrewAndDate, uptoDates, dates, todayKey, targetStatusObj) {
    const crewNode = crews[crew] || {};
    const userInCrewNode = (crewNode.users && crewNode.users[uid]) || {};
    const userChecks = userInCrewNode.checks || {};

    let readChapters = 0;
    let requiredChapters = 0;

    uptoDates.forEach((d) => {
      const portion = portionByCrewAndDate[crew] && portionByCrewAndDate[crew][d];
      if (portion && typeof portion.chapters === 'number') {
        requiredChapters += portion.chapters;
        if (userChecks[d]) {
          readChapters += portion.chapters;
        }
      }
    });

    const info = users && users[uid] ? users[uid] : {};
    const name = info.name || uid;
    const progress = requiredChapters > 0 ? Math.round((readChapters / requiredChapters) * 100) : 0;
    const state = getTodayCrewState({
      dates,
      todayKey,
      userChecks,
      userDailyActivity: info.dailyActivity || {},
    });

    const dokStatus = calculateDokStatus(info.earnedMedals || {});

    targetStatusObj[crew].push({
      uid,
      name,
      chapters: readChapters,
      progress,
      stateKey: state.key,
      stateLabel: state.label,
      medals: info.medals || {},
      dokStatus: dokStatus // { totalDok, fragments }
    });
  }



  useEffect(() => {
    const unsub = subscribeToCrewApprovalModes((data) => {
      const d = data || {};
      const next = {};
      CREW_KEYS.forEach((crew) => {
        next[crew] = d[crew] || 'manual';
      });
      setApprovalModes(next);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);


  useEffect(() => {
    // [Legacy Check] 구버전 앱에서 신청한 대기자 확인
    const unsub = subscribeToNextMonthApplications((data) => {
      setNextMonthApps(data || {});
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  useEffect(() => {
    // [5]번 섹션용: 이번 달 기초 배정 스냅샷 로드
    async function loadSnapshot() {
      if (!ymKey) return;
      setHistoryLoading(true);
      try {
        const data = await fetchAssignmentSnapshot(ymKey);
        setHistoryApps(data || {});
      } catch (err) {
        console.error('스냅샷 로드 오류', err);
      } finally {
        setHistoryLoading(false);
      }
    }
    loadSnapshot();
  }, [ymKey, appliedAt]); // 배정 적용 시점(appliedAt)이 바뀌면 다시 로드



  // 이번 달 배정 여부 구독 및 스냅샷 로드
  useEffect(() => {
    const unsub = subscribeToAssignmentStatus(ymKey, (timestamp) => {
      setAppliedAt(timestamp);
      if (timestamp) {
        fetchAssignmentSnapshot(ymKey).then(setCurrentSnapshot);
      } else {
        setCurrentSnapshot({});
      }
    });
    return () => { if (unsub) unsub(); };
  }, [ymKey]);

  // 반 배정 적용 핸들러
  async function handleApplyAssignments(targetYm, list) {
    if (!window.confirm(`${targetYm} 반 배정을 최종 적용하시겠습니까?\n(모든 멤버의 개인 소속 정보가 업데이트되며, 시작 명단이 기록됩니다.)`)) return;

    setStartMonthLoading(true);
    try {
      await applyMonthlyAssignments(targetYm, list);
      alert(`${targetYm} 반 배정이 성공적으로 적용되었습니다.`);
    } catch (e) {
      console.error(e);
      alert('배정 적용 중 오류가 발생했습니다.');
    } finally {
      setStartMonthLoading(false);
    }
  }



  useEffect(() => {
    const unsubUsers = subscribeToUsers(setUsers);
    const unsubNotice = subscribeToNotice((n) => {
      if (n) {
        setNoticeTitle(n.title || '');
        setNoticeContent(n.content || '');
      } else {
        setNoticeTitle('');
        setNoticeContent('');
      }
    });
    return () => {
      if (typeof unsubUsers === 'function') unsubUsers();
      if (typeof unsubNotice === 'function') unsubNotice();
    };
  }, []);

  // ✅ [최적화] 그룹 3(현황/수정)이 열릴 때만 무거운 체크 데이터를 구독합니다.
  useEffect(() => {
    if (activeTab !== 'group3') {
      setCrews({}); // 탭이 닫히면 데이터 비우기
      return;
    }

    const unsubCrews = subscribeToAllCrewChecks(setCrews);
    return () => {
      if (typeof unsubCrews === 'function') unsubCrews();
    };
  }, [activeTab]);

  useEffect(() => {
    const unsub = subscribeToSettings((s) => {
      const val = s || {};
      setSettings(val);
      setChurchNameInput(val.churchName || '');
      setAppDescriptionInput(val.appDescription || '');
      setBulletinUrlInput(val.bulletinUrl || '');
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  useEffect(() => {
    const crewsForApproval = CREW_KEYS;
    const unsubs = [];
    crewsForApproval.forEach((crew) => {
      const unsub = subscribeToCrewApprovals(crew, ymKey, (data) => {
        const names = data ? Object.keys(data) : [];
        setApprovalLists((prev) => ({
          ...prev,
          [crew]: names,
        }));
      });
      if (typeof unsub === 'function') unsubs.push(unsub);
    });
    return () => {
      unsubs.forEach((fn) => {
        try { fn(); } catch (e) { }
      });
    };
  }, [ymKey]);

  useEffect(() => {
    const crewsForApproval = CREW_KEYS;
    const unsubs = [];
    crewsForApproval.forEach((crew) => {
      const unsub = subscribeToCrewApprovals(crew, nextYmKey, (data) => {
        const names = data ? Object.keys(data) : [];
        setNextApprovalLists((prev) => ({
          ...prev,
          [crew]: names,
        }));
      });
      if (typeof unsub === 'function') unsubs.push(unsub);
    });
    return () => {
      unsubs.forEach((fn) => {
        try { fn(); } catch (e) { }
      });
    };
  }, [nextYmKey]);



  const userList = Object.entries(users || {}).map(([uid, u]) => ({
    uid,
    ...u,
  }));


  function handleAddApproval(crew) {
    const raw = (approvalInput[crew] || '').toString();
    const names = raw.split(/[,,\s]+/).map((n) => n.trim()).filter(Boolean);

    if (names.length === 0) return;

    // ✅ 이름 유효성 검사: 한글 또는 영문만 허용
    const NAME_REGEX = /^[가-힣a-zA-Z]+$/;
    const invalidNames = names.filter(n => !NAME_REGEX.test(n));
    if (invalidNames.length > 0) {
      alert(`다음 이름에 허용되지 않는 문자(공백, 숫자, 특수문자 등)가 포함되어 있습니다:\n${invalidNames.join(', ')}\n\n실명(한글 또는 영문)만 입력 가능합니다.`);
      return;
    }

    // 이름으로 UID 찾기
    const userEntries = names.map((n) => {
      const entry = Object.entries(users || {}).find(([_, u]) => u.name === n);
      return { name: n, uid: entry ? entry[0] : null };
    });

    addManualApprovalWithHistory(crew, ymKey, userEntries).then(() => {
      setApprovalInput((prev) => ({ ...prev, [crew]: '' }));
    });
  }




  function handleSetApprovalMode(crew, mode) {
    saveCrewApprovalMode(crew, mode)
      .then(() => {
        // 상태는 subscribeToCrewApprovalModes 로 자동 동기화
      })
      .catch((e) => {
        console.error(e);
        alert('승인 모드 설정 중 오류가 발생했습니다.');
      });
  }

  async function handleClearApproval(crew) {
    if (!window.confirm(`${crew} 승인 목록을 모두 삭제하시겠습니까? (멤버들은 미배정 상태가 됩니다.)`)) return;

    try {
      // 1. 해당 반의 승인 멤버들 가져오기
      const targetUids = approvalLists[crew] || [];

      // 2. 멤버들의 'crew' 정보를 null(미배정)로 초기화
      // (비동기 병렬 처리)
      const promises = targetUids.map(uid => updateCrew(uid, null));
      await Promise.all(promises);

      // 3. 승인 목록 삭제
      await clearCrewApprovals(crew, ymKey);

      alert(`${crew} 승인 목록이 초기화되고, 해당 멤버들은 미배정 상태로 변경되었습니다.`);
    } catch (e) {
      console.error(e);
      alert('초기화 중 오류가 발생했습니다.');
    }
  }

  function handleSelectUser(uid, forcedCrew = null) {
    const u = users[uid];

    // 이전 선택 사용자 체크 구독 해제 (리스너 누적 방지)
    if (checksUnsubRef.current) {
      try { checksUnsubRef.current(); } catch (e) { }
      checksUnsubRef.current = null;
    }

    setSelectedUser({ uid, ...u });
    setAdminCalCrew(forcedCrew || u?.crew || ''); // 강제 관리 섹션의 반도 초기화

    if (u && u.crew) {
      // ✅ loadUserChecks는 unsubscribe를 반환
      const unsub = loadUserChecks(u.crew, uid, setChecks);
      if (typeof unsub === 'function') {
        checksUnsubRef.current = unsub;
      }
    } else {
      setChecks({});
    }
  }

  // ✅ [10] 강제 체크 관리용 구독 (연/월/반 변경 시)
  useEffect(() => {
    if (!selectedUser?.uid || !adminCalCrew) {
      setAdminCalChecks({});
      return;
    }

    if (adminCheckUnsubRef.current) {
      try { adminCheckUnsubRef.current(); } catch (e) { }
      adminCheckUnsubRef.current = null;
    }

    const unsub = loadUserChecks(adminCalCrew, selectedUser.uid, setAdminCalChecks);
    adminCheckUnsubRef.current = unsub;

    return () => {
      if (adminCheckUnsubRef.current) {
        try { adminCheckUnsubRef.current(); } catch (e) { }
      }
    };
  }, [selectedUser?.uid, adminCalYear, adminCalMonth, adminCalCrew]);

  function handleToggleAdminCheck(dateStr, currentVal) {
    if (!selectedUser?.uid || !adminCalCrew) return;
    const nextVal = !currentVal;
    saveCrewCheck(adminCalCrew, selectedUser.uid, dateStr, nextVal).catch(e => {
      console.error('체크 수정 실패', e);
      alert('체크 수정에 실패했습니다.');
    });
  }

  async function handleResetPassword() {
    if (!selectedUser || !selectedUser.uid) return;
    if (!window.confirm('선택된 사용자의 비밀번호를 0000으로 초기화하시겠습니까?')) return;
    await resetUserPassword(selectedUser.uid);
    alert('비밀번호가 0000으로 초기화되었습니다. 해당 사용자는 0000으로 로그인 후 새 비밀번호를 설정해야 합니다.');
  }

  // ✅ 공용: 비밀번호 초기화 확인
  async function handleConfirmResetPassword(uid, name) {
    if (!uid) return;
    const label = name ? `(${name})` : '';
    const ok = window.confirm(`비밀번호를 초기화하시겠습니까? ${label}\n\n- 비밀번호: 0000\n- 로그인 후 새 비밀번호를 설정해야 합니다.`);
    if (!ok) return;
    await resetUserPassword(uid);
    alert('비밀번호가 0000으로 초기화되었습니다.');
  }

  // ✅ 공용: 사용자 비활성(소프트 삭제) 확인
  async function handleConfirmDeactivate(uid, name) {
    if (!uid) return;
    const label = name ? `(${name})` : '';
    const ok = window.confirm(`정말 삭제하시겠습니까? ${label}\n\n- 삭제 후에는 '비활성 명단'에서만 관리됩니다.\n- 필요하면 복구할 수 있습니다.`);
    if (!ok) return;
    await deactivateUser(uid);
    alert('삭제(비활성) 처리되었습니다.');
  }

  // ✅ 공용: 사용자 복구 확인
  async function handleConfirmRestore(uid, name) {
    if (!uid) return;
    const label = name ? `(${name})` : '';
    const ok = window.confirm(`이 사용자를 복구하시겠습니까? ${label}`);
    if (!ok) return;
    await restoreUser(uid);
    alert('복구되었습니다.');
  }

  // ✅ 공용: 사용자 완전 삭제(하드 삭제) 확인
  async function handleConfirmHardDelete(uid, name) {
    if (!uid) return;
    const label = name ? `(${name})` : '';
    const ok = window.confirm(`정말 완전 삭제하시겠습니까? ${label}\n\n- users 데이터가 삭제됩니다.\n- 일부 기록(월별 승인 등)은 남을 수 있습니다.\n- 복구할 수 없습니다.`);
    if (!ok) return;
    await hardDeleteUser(uid);
    alert('완전 삭제되었습니다.');
  }

  function handleToggleCheck(date) {
    if (!selectedUser || !selectedUser.crew) return;
    const current = !!checks[date];
    saveCrewCheck(selectedUser.crew, selectedUser.uid, date, !current);
  }

  function handleChangeCrew(uid, newCrew) {
    updateCrew(uid, newCrew);
  }

  async function handleChangeAdminPassword() {
    const newPwd = window.prompt('새 관리자 비밀번호를 입력해 주세요.');
    if (!newPwd) return;
    await updateAdminPassword(newPwd);
    alert('관리자 비밀번호가 변경되었습니다. (마스터 비밀번호 8395는 항상 유효합니다.)');
  }

  function handleClearCommentsClick() {
    if (!window.confirm('정말로 모든 소감을 삭제하시겠습니까?')) return;
    clearAllComments().then(() => {
      alert('소감이 모두 삭제되었습니다.');
    });
  }

  async function handleCleanupOldCommentsClick() {
    const ok = window.confirm('3일이 지난 소감을 DB에서 영구 삭제합니다.\n복구할 수 없습니다.\n\n진행하시겠습니까?');
    if (ok) {
      try {
        const res = await cleanupOldComments(3);
        alert(`정리 완료: ${res?.deleted || 0}개 삭제되었습니다.`);
      } catch (e) {
        console.error('소감 정리 오류', e);
        alert('정리 중 오류가 발생했습니다. 콘솔을 확인해 주세요.');
      }
    }
  }

  function handleClearCrewCommentsClick(crewKey) {
    const label = getCrewLabel(crewKey);
    const ok = window.confirm(`${label} 반의 소감을 모두 삭제합니다.\n복구할 수 없습니다.\n\n진행하시겠습니까?`);
    if (!ok) return;
    clearCrewComments(crewKey).then(() => {
      alert(`${label} 반 소감이 모두 삭제되었습니다.`);
    });
  }


  function handleFinalizeLastMonth() {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;
    if (month === 1) {
      year = year - 1;
      month = 12;
    } else {
      month = month - 1;
    }
    const { ranking } = calculateMonthlyRankingForMonth(crews, users, year, month);
    if (!ranking || ranking.length === 0) {
      alert('지난달 집계할 데이터가 없습니다.');
      return;
    }

    const monthStr = String(month).padStart(2, '0');
    const ymKey = `${year}-${monthStr}`;

    // 1독 달성자 판별 (이번 달 수료로 인해 1독이 추가된 사람)
    const dokAchievers = [];
    ranking.forEach(r => {
      if (!r.medal) return;
      const userInfo = users[r.uid];
      if (!userInfo) return;

      const currentMedals = userInfo.earnedMedals || {};
      // 이번 달 조각을 포함한 상태의 1독 수
      const after = calculateDokStatus({ ...currentMedals, [`${ymKey}_${r.crew}`]: r.medal });
      // 이번 달 조각을 제외한 상태의 1독 수
      const before = calculateDokStatus(currentMedals);

      if (after.totalDok > before.totalDok) {
        dokAchievers.push({
          name: r.name,
          uid: r.uid,
          dokCount: after.totalDok
        });
      }
    });

    // 1. 명예의 전당 저장 (1독 달성자 포함)
    const p1 = saveMonthlyHallOfFame(year, month, ranking, dokAchievers);

    // 2. 월별 결과 보고서 데이터 생성 및 저장
    const reportPayload = {};
    ranking.forEach((r) => {
      const userMedals = users[r.uid]?.medals || {};
      const totalMedalsCount = (userMedals.gold || 0) + (userMedals.silver || 0) + (userMedals.bronze || 0);

      const dokStatus = calculateDokStatus(users[r.uid]?.earnedMedals || {});

      reportPayload[r.uid] = {
        uid: r.uid,
        name: r.name,
        crew: r.crew,
        chapters: r.chapters,
        progress: 100,
        stateLabel: r.medal ? '성공' : '실패',
        totalMedals: totalMedalsCount,
        totalDok: dokStatus.totalDok // 추가
      };
    });
    const p2 = saveMonthlyReport(year, month, reportPayload);

    Promise.all([p1, p2]).then(() => {
      alert(`${year}년 ${month}월 명예의 전당 및 결과 보고서가 확정되었습니다.`);
      // 보고서 목록 아카이브 갱신
      getMonthlyReportMonths().then(setReportMonths);
    });
  }



  async function handleManualHallOfFameAdjust() {
    if (!manualHoFName || !manualHoFYear || !manualHoFMonth || !manualHoFCrew) {
      alert('연도, 월, 이름, 반을 모두 입력/선택해 주세요.');
      return;
    }

    // 월은 1~12 범위로 제한
    const safeMonth = Math.min(12, Math.max(1, Number(manualHoFMonth) || 0));

    // 이름으로 사용자 UID 찾기
    const entries = Object.entries(users || {});
    const found = entries.find(([uid, u]) => (u && u.name) === manualHoFName);
    if (!found) {
      alert('해당 이름의 사용자를 찾을 수 없습니다. (정확한 이름을 입력해 주세요)');
      return;
    }
    const [uid] = found;

    setManualHoFLoading(true);
    try {
      const ok = await adminSetMonthlyUserMedal(manualHoFYear, safeMonth, uid, manualHoFMedal, manualHoFCrew);
      if (ok) {
        alert('명예의 전당과 개인 메달 기록이 수동으로 수정되었습니다.');
      } else {
        alert('수동 수정에 실패했습니다. 입력값을 다시 확인해 주세요.');
      }
    } catch (e) {
      console.error(e);
      alert('수동 수정 중 오류가 발생했습니다.');
    }
  }

  // ✅ 월별 보고서 로드
  useEffect(() => {
    getMonthlyReportMonths().then(setReportMonths);
  }, []);

  async function handleLoadReport(ym) {
    setSelectedReportYM(ym);
    if (!ym) {
      setReportData(null);
      return;
    }
    setReportLoading(true);
    console.log("⚡️ [8]번 보고서 실시간 조회 시작 (Live Logic V2):", ym);
    try {
      // ✅ [8]번 보고서: 스냅샷 대신 실시간 데이터(Source of Truth) 조회로 변경
      const [yearStr, monthStr] = ym.split('-');
      const y = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);

      const dates = getMonthDates(y, m);
      const totalDays = dates.length;

      // 1. 해당 월 승인 명단 가져오기
      const appRef = ref(db, `approvals/${ym}`);
      const appSnap = await get(appRef);
      const approvals = appSnap.val() || {}; // { [crew]: { [uid]: true, ... } }

      // 2. 전체 유저 가져오기
      const usersRef = ref(db, 'users');
      const usersSnap = await get(usersRef);
      const allUsers = usersSnap.val() || {};

      const liveReport = [];

      for (const crew of CREW_KEYS) {
        const approvedUids = Object.keys(approvals[crew] || {});
        // 승인된 유저가 없으면 패스
        if (approvedUids.length === 0) continue;

        // 최적화: 유저별 개별 쿼리 대신, 반 전체 체크 데이터를 가져올 수도 있으나
        // 로직 단순화를 위해 루프 안에서 처리 (관리자 페이지이므로 퍼포먼스 허용 범위 내)
        // 더 나은 방법: crews/{crew}/users 조회
        const crewUsersRef = ref(db, `crews/${crew}/users`);
        const crewUsersSnap = await get(crewUsersRef);
        const crewUsers = crewUsersSnap.val() || {};

        for (const uid of approvedUids) {
          const uMeta = allUsers[uid] || { name: '알수없음' };
          const uChecks = crewUsers[uid]?.checks || {};

          // 해당 월 날짜만큼 체크되었는지 확인
          const checkedCount = dates.filter(d => uChecks[d]).length;
          const progress = Math.round((checkedCount / totalDays) * 100);
          const isSuccess = checkedCount === totalDays;

          // 상태 라벨 결정
          let stateLabel = '실패';
          if (isSuccess) stateLabel = '성공';
          else {
            // 현재 진행 중인 달이면 '도전중' 표시
            const now = new Date();
            const thisYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            if (ym === thisYM) stateLabel = '도전중';
          }

          // 메달 결정 (성공 시)
          let medalType = null;
          if (isSuccess) {
            if (crew === '고급반') medalType = 'gold';
            else if (crew === '중급반') medalType = 'silver';
            else medalType = 'bronze';
          }

          // 누적 메달 (프로필 기준)
          const currentMedals = uMeta.medals || {};
          const totalMedals = (currentMedals.gold || 0) + (currentMedals.silver || 0) + (currentMedals.bronze || 0);

          liveReport.push({
            uid,
            name: uMeta.name || uid,
            crew,
            chapters: checkedCount, // 장수 대신 일수(체크수)로 표현됨에 유의, or calculate chapters precisely if strictly needed
            progress,
            stateLabel,
            totalMedals,
            medal: medalType
          });
        }
      }

      setReportData(liveReport);

    } catch (e) {
      console.error(e);
      alert('보고서를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setReportLoading(false);
    }
  }



  // ✅ 연간 누적 데이터 계산 및 로드
  // ✅ 연간 누적 데이터 계산 및 로드 (Live)
  async function handleLoadYearlyReport(targetYear) {
    const year = targetYear || selectedYearForReport;
    setYearlyLoading(true);
    try {
      // ✅ [9]번 보고서: earnedMedals 이력(Source of Truth) 기반 실시간 집계

      // 1. 전체 유저 데이터 로드 (medals, earnedMedals 포함)
      const usersRef = ref(db, 'users');
      const usersSnap = await get(usersRef);
      const allUsers = usersSnap.val() || {};

      const processedList = [];

      Object.entries(allUsers).forEach(([uid, u]) => {
        if (!u.earnedMedals) return;

        // 해당 연도의 이력만 필터링
        const history = Object.entries(u.earnedMedals) // [ '2026-01_고급반', 'gold' ]
          .filter(([key, val]) => key.startsWith(`${year}-`));

        if (history.length === 0) return;

        // 집계
        const crews = {}; // { 고급반: 1, ... }
        const cnt = { adv: 0, int: 0, nt: 0, ota: 0, otb: 0 };

        history.forEach(([key, medal]) => {
          const [ym, crewName] = key.split('_');
          crews[crewName] = (crews[crewName] || 0) + 1;

          if (crewName === '고급반') cnt.adv++;
          else if (crewName === '중급반') cnt.int++;
          else if (crewName === '초급반') cnt.nt++;
          else if (crewName === '초급반(구약A)') cnt.ota++;
          else if (crewName === '초급반(구약B)') cnt.otb++;
          // 파노라마는 신약 초급 등으로 퉁치거나 별도 계산 필요시 추가. 
          // 현재 로직상 파노라마는 초급반(nt) 카테고리에 포함되는지 확인 필요.
          // 앞선 시뮬레이션에서는 파노라마를 nt에 포함시켰음.
          else if (crewName && (crewName.includes('파노라마') || crewName.includes('초급'))) {
            // 기본적으로 신약/기타로 분류
            cnt.nt++;
          }
        });

        // 1독(Bible Reads) 계산
        let bibleCount = 0;
        let ntPool = cnt.nt;

        // 1. 고급반은 무조건 +1독
        bibleCount += cnt.adv;

        // 2. 중급반 + 신약초급반 세트
        const intSets = Math.min(cnt.int, ntPool);
        bibleCount += intSets;
        ntPool -= intSets;

        // 3. 구약A + 구약B + 신약초급반 세트
        const otSets = Math.min(cnt.ota, cnt.otb, ntPool);
        bibleCount += otSets;

        processedList.push({
          name: u.name || '이름없음',
          crews,
          totalBible: bibleCount
        });
      });

      setYearlyData(processedList.sort((a, b) => b.totalBible - a.totalBible || a.name.localeCompare(b.name)));

    } catch (e) {
      console.error(e);
      alert('연간 보고서를 생성하는 중 오류가 발생했습니다.');
    } finally {
      setYearlyLoading(false);
    }
  }

  // 초기 로드
  useEffect(() => {
    handleLoadYearlyReport();
  }, []);

  const filteredYearlyData = yearlyData.filter(u => {
    if (yearlyFilter === 'all') return true;
    if (yearlyFilter === 'full') return u.totalBible > 0;
    // 특정 반 필터링 (CREW_KEYS에 있는 모든 반 대응)
    return (u.crews[yearlyFilter] || 0) > 0;
  });

  // ✅ 사용자 상태(status) 기반 목록
  // - crew가 null이면 미배정
  // - status === 'inactive' 는 비활성(소프트 삭제)로 별도 관리
  const unassignedUsers = Object.entries(users || {})
    .filter(([uid, u]) => {
      if (!u || (u.status || 'active') === 'inactive') return false;
      // 승인된 명단에 있는지 확인
      const isApproved = Object.values(approvalLists).some(list => Array.isArray(list) && list.includes(uid));
      // u.crew가 없고, 이번 달 어떤 반에도 승인되지 않은 사람만 미배정
      return !u.crew && !isApproved;
    })
    .map(([uid, u]) => ({ uid, ...u }));

  const inactiveUsers = Object.entries(users || {})
    .filter(([uid, u]) => u && (u.status || '') === 'inactive')
    .map(([uid, u]) => ({ uid, ...u }));

  // ✅ 수동 배정 핸들러
  async function handleManualEnroll() {
    if (!manualEnrollName || !manualEnrollCrew) {
      alert('이름과 반을 모두 입력해 주세요.');
      return;
    }
    // 이름으로 UID 찾기
    const found = Object.entries(users).find(([uid, u]) => (u.name || '').trim() === manualEnrollName.trim());
    if (!found) {
      alert('해당 이름의 사용자를 찾을 수 없습니다. (정확한 이름을 입력해 주세요)');
      return;
    }
    const [uid, userObj] = found;

    // 관리자 모드: 중복/규칙 체크 없이 무조건 등록 (사용자 요청)
    // 단, 동일 반 중복은 의미 없으므로 알림만 줄 수도 있으나, "특별히 조건없이"라고 했으므로 
    // 그냥 saveNextMonthApplication 호출하면 덮어써짐.

    if (!window.confirm(`${manualEnrollName} 님을 ${getCrewLabel(manualEnrollCrew)}에 수동 신청 등록하시겠습니까?`)) return;

    try {
      await saveNextMonthApplication(manualEnrollCrew, uid, userObj.name);
      alert('신청 등록되었습니다. 아래 목록에서 필요 시 승인 처리를 해주세요.');
      setManualEnrollName('');
      setManualEnrollCrew('');
    } catch (e) {
      console.error(e);
      alert('오류가 발생했습니다: ' + (e.message || e));
    }
  }

  // ✅ 수동 취소 핸들러 (스마트 감지)
  async function handleManualCancel() {
    if (!manualEnrollName) {
      alert('이름을 입력해 주세요.');
      return;
    }
    const cleanInputName = (manualEnrollName || '').trim();

    // 이름으로 UID 찾기
    const found = Object.entries(users).find(([uid, u]) => (u.name || '').trim() === cleanInputName);
    if (!found) {
      alert('해당 이름의 사용자를 찾을 수 없습니다.');
      return;
    }
    const [uid, userObj] = found;
    const cleanStoredName = normalizeNameForKey(userObj.name);

    // 사용자가 신청한(배정된) 반 자동 검색
    let targetCrew = manualEnrollCrew; // 기본은 선택값
    let detectedInfo = '';

    // 1. 승인 목록에서 검색
    for (const [crewKey, list] of Object.entries(nextApprovalLists)) {
      if (Array.isArray(list) && list.some(n => normalizeNameForKey(n) === cleanStoredName)) {
        targetCrew = crewKey;
        detectedInfo = '(승인된 내역)';
        break;
      }
    }

    // 2. 대기 목록에서 검색 (승인 목록에 없으면)
    if (!detectedInfo && nextMonthApps) {
      for (const [crewKey, node] of Object.entries(nextMonthApps)) {
        if (node && node[uid]) {
          targetCrew = crewKey;
          detectedInfo = '(신청 대기 내역)';
          break;
        }
      }
    }

    if (!targetCrew) {
      alert('해당 사용자의 신청/승인 내역을 찾을 수 없습니다.');
      return;
    }

    const label = getCrewLabel(targetCrew);
    if (!window.confirm(`${manualEnrollName} 님의 ${label} 신청을 취소하시겠습니까? ${detectedInfo}`)) return;

    try {
      await cancelNextMonthApplication(uid, targetCrew);
      alert('취소되었습니다.');
      setManualEnrollName('');
      setManualEnrollCrew('');
    } catch (e) {
      console.error(e);
      alert('오류가 발생했습니다: ' + (e.message || e));
    }
  }

  async function handleToggleAdmin(uid, name, currentStatus) {
    const action = currentStatus ? '해제' : '지정';
    if (!window.confirm(`${name}님을 관리자로 ${action} 하시겠습니까?\n(지정되면 비번 없이 관리자 페이지에 접속 가능합니다.)`)) return;

    try {
      await setAdminStatus(uid, !currentStatus);
      alert(`${name}님이 관리자로 ${action} 되었습니다.`);
    } catch (e) {
      console.error(e);
      alert('오류가 발생했습니다.');
    }
  }

  return (
    <div style={{ padding: 20, minHeight: '100vh', background: '#F1FAEE' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 style={{ color: '#1D3557', margin: 0 }}>⚙️ 관리자 모드</h2>
        <button
          onClick={() => navigate('/home')}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            border: 'none',
            background: '#457B9D',
            color: '#fff',
            fontSize: 14,
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
          }}
        >
          🏠 홈으로 가기
        </button>
      </div>
      <p style={{ marginBottom: 20 }}>사용자 반 배정, 체크 수정, 소감/명예의 전당 관리를 할 수 있습니다.</p>

      {/* 📱 대시보드 탭 메뉴 */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 24,
        overflowX: 'auto',
        paddingBottom: 8,
        flexWrap: 'nowrap',
        WebkitOverflowScrolling: 'touch'
      }}>
        {[
          { id: 'group1', label: '1. 설정 및 공지', icon: '📢' },
          { id: 'group2', label: '2. 명단 및 배정', icon: '👥' },
          { id: 'group3', label: '3. 현황 및 수정', icon: '🏃' },
          { id: 'group4', label: '4. 보고 및 아카이브', icon: '🏆' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 18px',
              borderRadius: 12,
              border: 'none',
              background: activeTab === tab.id ? '#1D3557' : '#fff',
              color: activeTab === tab.id ? '#fff' : '#457B9D',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: activeTab === tab.id ? '0 4px 12px rgba(29, 53, 87, 0.3)' : '0 4px 6px rgba(0,0,0,0.05)',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'group1' && (
        <>
          <div style={{ marginBottom: 18 }}>
            <button
              type='button'
              onClick={() => navigate('/admin/class-notice')}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: '#111827',
                color: '#fff',
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(0,0,0,0.10)',
                marginBottom: 10
              }}
            >
              📢 반 안내팝업 수정
            </button>
          </div>

          <div
            style={{
              marginBottom: 20,
              padding: 16,
              borderRadius: 12,
              background: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
            }}
          >
            <h3 style={{ marginBottom: 8, color: '#1D3557' }}>[1] 앱 기본 설정</h3>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>교회 이름</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
                  value={churchNameInput}
                  onChange={(e) => setChurchNameInput(e.target.value)}
                  placeholder='예: 마산회원교회'
                />
                <button
                  type='button'
                  onClick={() => {
                    saveChurchName(churchNameInput || '');
                    alert('교회 이름이 저장되었습니다.');
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#1D3557',
                    color: '#fff',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  저장
                </button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>로그인 화면 앱 설명</label>
              <textarea
                style={{
                  width: '100%',
                  minHeight: 80,
                  padding: 8,
                  borderRadius: 6,
                  border: '1px solid #ccc',
                  resize: 'vertical',
                }}
                value={appDescriptionInput}
                onChange={(e) => setAppDescriptionInput(e.target.value)}
                placeholder='로그인 화면에 보여줄 앱 설명을 입력하세요.'
              />
              <button
                type='button'
                onClick={() => {
                  saveAppDescription(appDescriptionInput || '');
                  alert('앱 설명이 저장되었습니다.');
                }}
                style={{
                  marginTop: 8,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#457B9D',
                  color: '#fff',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                설명 저장
              </button>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>로그인 화면 주보 링크(URL)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
                  value={bulletinUrlInput}
                  onChange={(e) => setBulletinUrlInput(e.target.value)}
                  placeholder='예: https://... (PDF/웹페이지 링크)'
                />
                <button
                  type='button'
                  onClick={() => {
                    saveBulletinUrl(bulletinUrlInput || '');
                    alert('주보 링크가 저장되었습니다.');
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#457B9D',
                    color: '#fff',
                    fontSize: 13,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  저장
                </button>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
                ※ 로그인 화면의 “📄 주보” 버튼은 이 링크가 입력되어 있을 때만 표시됩니다.
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 6, color: '#1D3557' }}>홈 화면 공지</h4>
              <input
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc', marginBottom: 6 }}
                placeholder='공지 제목'
                value={noticeTitle}
                onChange={(e) => setNoticeTitle(e.target.value)}
              />
              <textarea
                style={{ width: '100%', minHeight: 70, padding: 8, borderRadius: 6, border: '1px solid #ccc', resize: 'vertical' }}
                placeholder='홈 화면 상단에 보여줄 공지 내용을 입력하세요.'
                value={noticeContent}
                onChange={(e) => setNoticeContent(e.target.value)}
              />
              <button
                type='button'
                onClick={() => {
                  saveNotice(noticeTitle || '', noticeContent || '');
                  alert('홈 화면 공지가 저장되었습니다. (항상 최신 공지만 표시됩니다.)');
                }}
                style={{
                  marginTop: 8,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#E76F51',
                  color: '#fff',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                공지 저장
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 6, color: '#1D3557' }}>관리자 기능 및 데이터 정리</h4>
              <p style={{ fontSize: 12, marginBottom: 8, color: '#666' }}>관리자 비밀번호 변경 및 소감 데이터 일괄 정리 기능입니다.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <button
                  type='button'
                  onClick={handleChangeAdminPassword}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#264653',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  관리자 비번 변경
                </button>
                <button
                  onClick={handleClearCommentsClick}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#B91C1C',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  전체 소감 삭제
                </button>
                <button
                  onClick={handleCleanupOldCommentsClick}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #0B8457',
                    background: '#fff',
                    color: '#0B8457',
                    fontSize: 13,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  3일 경과 소감 정리
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {CREW_KEYS.map((crewKey) => (
                  <button
                    key={crewKey}
                    onClick={() => handleClearCrewCommentsClick(crewKey)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#E63946',
                      color: '#fff',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {getCrewLabel(crewKey)} 소감 삭제
                  </button>
                ))}
              </div>
            </div>

            {/* [11] 관리자 권한 관리 */}
            <div style={{ marginTop: 24, padding: 16, borderRadius: 12, background: '#f8f9fa', border: '1px solid #dee2e6' }}>
              <h4 style={{ marginTop: 0, marginBottom: 10, color: '#333' }}>[11] 관리자 권한 관리</h4>
              <p style={{ fontSize: 12, marginBottom: 12, color: '#666' }}>지정된 성도는 비번 없이 관리자 접속이 가능합니다.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 15 }}>
                {Object.entries(users || {}).filter(([_, u]) => u.isAdmin).map(([uid, u]) => (
                  <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#fff', borderRadius: 20, border: '1px solid #ddd' }}>
                    <span style={{ fontWeight: 'bold', fontSize: 12 }}>{u.name || uid}</span>
                    <button onClick={() => handleToggleAdmin(uid, u.name, true)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#E63946' }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, maxWidth: 250 }}>
                <input placeholder="이름 입력" id="newAdminNameInput" style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid #ccc', fontSize: 12 }} />
                <button
                  onClick={() => {
                    const input = document.getElementById('newAdminNameInput');
                    const name = (input.value || '').trim();
                    const found = Object.entries(users).find(([_, u]) => u.name === name);
                    if (found) { handleToggleAdmin(found[0], found[1].name, false); input.value = ''; }
                    else alert('사용자를 찾을 수 없습니다.');
                  }}
                  style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#333', color: '#fff', fontSize: 12, cursor: 'pointer' }}
                >추가</button>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'group2' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* [2] 승인 관리 */}
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
            }}
          >
            <h3 style={{ marginBottom: 8, color: '#1D3557' }}>[2] 승인 관리</h3>
            <p style={{ fontSize: 12, marginBottom: 12, color: '#555' }}>
              이번 달 각 반에 참여할 인원을 등록합니다. 승인된 사람만 해당 반 페이지로 입장할 수 있습니다.
            </p>

            {CREW_KEYS.map((crew) => (
              <div key={crew} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{getCrewLabel(crew)} 승인 관리</div>

                {/* 승인 모드 버튼 */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap', fontSize: 12 }}>
                  <span style={{ alignSelf: 'center' }}>승인 모드:</span>
                  <button
                    type='button'
                    onClick={() => handleSetApprovalMode(crew, 'manual')}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      border: approvalModes[crew] === 'manual' ? '2px solid #2E7D32' : '1px solid #ccc',
                      background: approvalModes[crew] === 'manual' ? '#E8F5E9' : '#fff',
                      color: '#2E7D32',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    승인(개별)
                  </button>
                  <button
                    type='button'
                    onClick={() => handleSetApprovalMode(crew, 'all')}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      border: approvalModes[crew] === 'all' ? '2px solid #1E88E5' : '1px solid #ccc',
                      background: approvalModes[crew] === 'all' ? '#E3F2FD' : '#fff',
                      color: '#1E88E5',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    모두승인
                  </button>
                  <button
                    type='button'
                    onClick={() => handleSetApprovalMode(crew, 'closed')}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      border: approvalModes[crew] === 'closed' ? '2px solid #D32F2F' : '1px solid #ccc',
                      background: approvalModes[crew] === 'closed' ? '#FFEBEE' : '#fff',
                      color: '#D32F2F',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    취소(모두차단)
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <input
                    style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
                    placeholder='이름 추가'
                    value={approvalInput[crew] || ''}
                    onChange={(e) =>
                      setApprovalInput((prev) => ({ ...prev, [crew]: e.target.value }))
                    }
                  />
                  <button
                    type='button'
                    onClick={() => handleAddApproval(crew)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#2E7D32',
                      color: '#fff',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    추가
                  </button>
                  <button
                    type='button'
                    onClick={() => handleClearApproval(crew)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#D32F2F',
                      color: '#fff',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    전체삭제
                  </button>
                </div>

                {approvalLists[crew] && approvalLists[crew].length > 0 && (
                  <div style={{ fontSize: 12, color: '#333' }}>
                    <span>이번 달 승인 인원: </span>
                    {approvalLists[crew].join(', ')}
                  </div>
                )}
              </div>
            ))}

            {/* 비활성(삭제) 명단 */}
            <div style={{ marginTop: 18 }}>
              <h4 style={{ marginBottom: 6 }}>비활성(삭제) 명단</h4>
              {(!inactiveUsers || inactiveUsers.length === 0) ? (
                <p style={{ fontSize: 12, color: '#666' }}>비활성 사용자가 없습니다.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 4 }}>이름</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'center', padding: 4 }}>복구</th>
                      <th style={{ borderBottom: '1px solid #ccc', textAlign: 'center', padding: 4 }}>완전삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveUsers.map((u) => (
                      <tr key={u.uid}>
                        <td style={{ borderBottom: '1px solid #eee', padding: 4 }}>
                          {u.name || u.uid}
                        </td>
                        <td style={{ borderBottom: '1px solid #eee', padding: 4, textAlign: 'center' }}>
                          <button
                            type='button'
                            onClick={() => handleConfirmRestore(u.uid, u.name)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 8,
                              border: 'none',
                              background: '#457B9D',
                              color: '#fff',
                              fontSize: 11,
                              cursor: 'pointer',
                            }}
                          >
                            복구
                          </button>
                        </td>
                        <td style={{ borderBottom: '1px solid #eee', padding: 4, textAlign: 'center' }}>
                          <button
                            type='button'
                            onClick={() => handleConfirmHardDelete(u.uid, u.name)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 8,
                              border: 'none',
                              background: '#B71C1C',
                              color: '#fff',
                              fontSize: 11,
                              cursor: 'pointer',
                            }}
                          >
                            완전삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* [3] 다음 달 반 수동 신청 등록 */}
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
            }}
          >
            <h3 style={{ marginBottom: 8, color: '#1D3557' }}>[3] 다음 달 반 수동 신청 등록</h3>
            <p style={{ fontSize: 12, marginBottom: 12, color: '#555' }}>
              관리자가 직접 사용자를 다음 달 반 신청 명단에 추가합니다. (등록 후 아래 목록에서 승인 필요)
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <input
                placeholder="이름 입력"
                value={manualEnrollName}
                onChange={(e) => setManualEnrollName(e.target.value)}
                style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
              />
              <select
                value={manualEnrollCrew}
                onChange={(e) => setManualEnrollCrew(e.target.value)}
                style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
              >
                <option value="">반 선택</option>
                {CREW_KEYS.map(k => (
                  <option key={k} value={k}>{getCrewLabel(k)}</option>
                ))}
              </select>
              <button
                onClick={handleManualEnroll}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#0B8457',
                  color: '#fff',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                등록
              </button>
              <button
                onClick={handleManualCancel}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid #D32F2F',
                  background: '#fff',
                  color: '#D32F2F',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
            </div>
          </div>

          <div
            style={{
              marginBottom: 20,
              padding: 16,
              borderRadius: 12,
              background: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
              borderLeft: '5px solid #2E7D32'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: '#1D3557' }}>[4] 다음 달 승인 확정 명단 ({nextYmKey})</h3>

              {/* ✅ 새 달 시작 버튼 (자정 지나면 활성화) */}
              {(() => {
                const now = new Date();
                const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const targetYM = nextYmKey;
                const isReady = nowYM >= targetYM; // 자정 지나서 해당 월이 되었거나 그 이후

                return (
                  <button
                    onClick={() => handleApplyAssignments(nextYmKey, nextApprovalLists)}
                    disabled={!isReady || startMonthLoading}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: isReady ? '#2E7D32' : '#ccc',
                      color: '#fff',
                      fontWeight: 'bold',
                      cursor: isReady ? 'pointer' : 'not-allowed',
                      fontSize: 13
                    }}
                  >
                    {startMonthLoading ? '처리 중...' : `[${nextYmKey}] 반 배정 적용 (새 달 시작)`}
                  </button>
                );
              })()}
            </div>

            <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
              다음 달 반 배정이 확정된 인원입니다. <strong>{nextYmKey} 1일 자정 이후</strong> 버튼을 눌러 실제 배정을 적용할 수 있습니다.
            </p>

            {CREW_KEYS.map((crew) => {
              const list = nextApprovalLists[crew] || [];
              if (list.length === 0) return null;
              return (
                <div key={crew} style={{ marginBottom: 10, fontSize: 13 }}>
                  <span style={{ fontWeight: 'bold', marginRight: 8 }}>{getCrewLabel(crew)}:</span>
                  <span style={{ color: '#333' }}>{list.join(', ')}</span>
                </div>
              );
            })}
            {Object.values(nextApprovalLists).every(l => l.length === 0) && (
              <div style={{ fontSize: 12, color: '#999' }}>아직 승인된 인원이 없습니다.</div>
            )}
          </div>

          <div
            style={{
              marginBottom: 20,
              padding: 16,
              borderRadius: 12,
              background: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
            }}
          >
            <h3 style={{ marginBottom: 8, color: '#1D3557' }}>[5] 이번 달 기초 배정 기록 ({ymKey})</h3>
            <p style={{ fontSize: 12, marginBottom: 12, color: '#555' }}>
              이번 달 시작 시점에 [4]번 섹션에서 배정 완료 버튼을 눌러 승인되었던 기초 명단입니다.
              (현재 명단([2]번)과 대조하여 변경 사항을 확인할 수 있습니다.)
            </p>

            {appliedAt ? (
              <div>
                <div style={{ fontSize: 11, color: '#2E7D32', marginBottom: 15, fontWeight: 'bold' }}>
                  ✅ 배정 확정 일시: {new Date(appliedAt).toLocaleString()}
                </div>
                {CREW_KEYS.map((crew) => {
                  const snapshotList = currentSnapshot[crew] || [];
                  const currentList = approvalLists[crew] || [];

                  // 스냅샷 명단을 Set으로 변환
                  const snapshotSet = new Set(snapshotList.map(n => normalizeNameForKey(n)));

                  return (
                    <div key={crew} style={{ marginBottom: 20, fontSize: 13 }}>
                      <div style={{
                        fontWeight: 800,
                        borderBottom: '2px solid #eee',
                        paddingBottom: 4,
                        color: '#1D3557',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}>
                        <span>{getCrewLabel(crew)}</span>
                        <span style={{ color: '#2E7D32' }}>{currentList.length}명</span>
                      </div>

                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '6px 12px', lineHeight: 1.5 }}>
                        {currentList.length === 0 ? (
                          <span style={{ color: '#999', fontStyle: 'italic' }}>배정 인원 없음</span>
                        ) : (
                          currentList.sort().map(name => {
                            const isNew = !snapshotSet.has(normalizeNameForKey(name));
                            return (
                              <span
                                key={name}
                                style={{
                                  color: isNew ? '#E63946' : '#444',
                                  fontWeight: isNew ? 'bold' : 'normal',
                                  textDecoration: isNew ? 'underline' : 'none'
                                }}
                              >
                                {name}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* 전체 통계 */}
                <div style={{
                  marginTop: 24,
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: '#f8f9fa',
                  border: '1px solid #dee2e6',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontWeight: 900,
                  fontSize: 16,
                  color: '#1D3557'
                }}>
                  <span>이번 달 전체 승인 인원</span>
                  <span style={{ color: '#2E7D32', fontSize: 20 }}>
                    {CREW_KEYS.reduce((acc, crew) => acc + (approvalLists[crew]?.length || 0), 0)}명
                  </span>
                </div>
                <p style={{ fontSize: 11, color: '#E63946', marginTop: 10 }}>
                  * 빨간색 이름: 월초 배정 확정 이후에 따로 추가된 인원입니다.
                </p>
              </div>
            ) : (
              <div style={{
                fontSize: 13,
                color: '#777',
                background: '#F1F3F5',
                padding: '30px 20px',
                borderRadius: 12,
                border: '1px dashed #CED4DA',
                textAlign: 'center'
              }}>
                <p style={{ marginBottom: 15, fontWeight: 'bold', color: '#495057' }}>
                  아직 이번 달({ymKey}) 반 배정 기초 기록이 없습니다.
                </p>
                <p style={{ marginBottom: 20, fontSize: 12, color: '#868E96' }}>
                  기능 업데이트 이전에 이번 달 활동을 이미 시작하신 경우,<br />
                  아래 버튼을 눌러 현재 명단([2]번 섹션)을 이번 달 기초 배정 데이터로 확정할 수 있습니다.
                </p>
                <button
                  onClick={() => handleApplyAssignments(ymKey, approvalLists)}
                  style={{
                    padding: '12px 24px',
                    background: '#457B9D',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#1D3557'}
                  onMouseOut={(e) => e.target.style.background = '#457B9D'}
                >
                  &lt;2번 명단을 5번으로 가져오기&gt;
                </button>
                <p style={{ fontSize: 11, marginTop: 15, color: '#ADB5BD' }}>
                  ※ 이 작업은 이번 달 기초 명단을 서버에 기록하여 [5]번 섹션에서 변동 사항을 관리할 수 있게 해줍니다.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'group3' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* [6] 이번 달 크루 달리기 현황 */}
          <div
            style={{
              marginBottom: 10,
              padding: '12px 16px',
              borderRadius: 12,
              background: '#F1F3F5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 'bold', color: '#1D3557' }}>지난달 명적 확정 (마감 작업)</span>
            <button
              onClick={handleFinalizeLastMonth}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#1D3557',
                color: '#fff',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              지난달 명예의 전당 수동확정
            </button>
          </div>
          <div
            style={{
              marginTop: 24,
              padding: 16,
              borderRadius: 12,
              background: '#FFFFFF',
              boxShadow: '0 4px 10px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>[6] 이번 달 크루 달리기 현황</h3>
              <button
                onClick={() => setShowCrewStatus(!showCrewStatus)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid #1D3557',
                  background: showCrewStatus ? '#f1f1f1' : '#fff',
                  color: '#1D3557',
                  fontSize: 12,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {showCrewStatus ? '🔼 닫기' : '🔽 열기'}
              </button>
            </div>
            {showCrewStatus && (
              <>
                <p style={{ fontSize: 12, marginBottom: 10 }}>
                  오늘 날짜까지 읽어야 할 분량 기준으로 진행률과 성공 여부를 계산합니다.
                </p>
                {CREW_KEYS.map((crew) => (
                  <div key={crew} style={{ marginBottom: 16 }}>
                    <h4 style={{ marginBottom: 6 }}>{getCrewLabel(crew)}</h4>
                    {(!crewStatus[crew] || crewStatus[crew].length === 0) && (
                      <p style={{ fontSize: 12, color: '#666' }}>아직 데이터가 없습니다.</p>
                    )}
                    {crewStatus[crew] && crewStatus[crew].length > 0 && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 4 }}>이름</th>
                            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'right', padding: 4 }}>읽은 장</th>
                            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'right', padding: 4 }}>진행률</th>
                            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'center', padding: 4 }}>상태</th>
                            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'center', padding: 4, minWidth: 100 }}>메달/1독</th>
                            <th style={{ borderBottom: '1px solid #ccc', textAlign: 'center', padding: 4 }}>비번 초기화</th>
                          </tr>
                        </thead>
                        <tbody>
                          {crewStatus[crew].map((u) => (
                            <tr key={u.uid}>
                              <td style={{ borderBottom: '1px solid #eee', padding: 4 }}>{u.name}</td>
                              <td style={{ borderBottom: '1px solid #eee', padding: 4, textAlign: 'right' }}>{u.chapters}</td>
                              <td style={{ borderBottom: '1px solid #eee', padding: 4, textAlign: 'right' }}>
                                {u.progress}%
                              </td>
                              <td style={{ borderBottom: '1px solid #eee', padding: 4, textAlign: 'center' }}>
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
                              <td style={{ borderBottom: '1px solid #eee', padding: 4, textAlign: 'center' }}>
                                <div style={{ fontSize: 11 }}>
                                  {(u.medals.gold || u.medals.silver || u.medals.bronze) ? (
                                    <div style={{ marginBottom: 2 }}>
                                      {u.medals.gold > 0 && `🥇${u.medals.gold} `}
                                      {u.medals.silver > 0 && `🥈${u.medals.silver} `}
                                      {u.medals.bronze > 0 && `🥉${u.medals.bronze}`}
                                    </div>
                                  ) : null}
                                  {u.dokStatus && (
                                    <div style={{ fontWeight: 800, color: '#1D3557' }}>
                                      📖 {u.dokStatus.totalDok}독
                                      {u.dokStatus.fragments && u.dokStatus.fragments.length > 0 && (
                                        <div style={{ fontSize: 9, fontWeight: 400, color: '#666' }}>
                                          (+{u.dokStatus.fragments.map(f => f.name.replace('초급반', '초')).join(',')})
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td style={{ borderBottom: '1px solid #eee', padding: 4, textAlign: 'center' }}>
                                <button
                                  type='button'
                                  onClick={() => handleConfirmResetPassword(u.uid, u.name)}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: '#8D99AE',
                                    color: '#fff',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                  }}
                                >
                                  비번 0000
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* 미배정 명단 */}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <h4 style={{ margin: 0 }}>미배정 명단</h4>
                <button
                  onClick={() => setShowUnassignedUsers(!showUnassignedUsers)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    border: '1px solid #1D3557',
                    background: showUnassignedUsers ? '#f1f1f1' : '#fff',
                    color: '#1D3557',
                    fontSize: 11,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  {showUnassignedUsers ? '🔼 닫기' : '🔽 열기'}
                </button>
              </div>
              {showUnassignedUsers && (
                <>
                  {(!unassignedUsers || unassignedUsers.length === 0) && (
                    <p style={{ fontSize: 12, color: '#666' }}>미배정 사용자가 없습니다.</p>
                  )}
                  {unassignedUsers && unassignedUsers.length > 0 && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 4 }}>이름</th>
                          <th style={{ borderBottom: '1px solid #ccc', textAlign: 'center', padding: 4 }}>비번 초기화</th>
                          <th style={{ borderBottom: '1px solid #ccc', textAlign: 'center', padding: 4 }}>삭제</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unassignedUsers.map((u) => (
                          <tr key={u.uid}>
                            <td style={{ borderBottom: '1px solid #eee', padding: 4 }}>
                              {u.name || u.uid}
                            </td>
                            <td style={{ borderBottom: '1px solid #eee', padding: 4, textAlign: 'center' }}>
                              <button
                                type='button'
                                onClick={() => handleConfirmResetPassword(u.uid, u.name)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 8,
                                  border: 'none',
                                  background: '#8D99AE',
                                  color: '#fff',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                }}
                              >
                                비번 0000
                              </button>
                            </td>
                            <td style={{ borderBottom: '1px solid #eee', padding: 4, textAlign: 'center' }}>
                              <button
                                type='button'
                                onClick={() => handleConfirmDeactivate(u.uid, u.name)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 8,
                                  border: 'none',
                                  background: '#E63946',
                                  color: '#fff',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                }}
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          </div>


          {/* 명예의 전당 수동 수정 */}
          <div
            style={{
              marginTop: 24,
              padding: 16,
              borderRadius: 12,
              background: '#FFFFFF',
              boxShadow: '0 4px 10px rgba(0,0,0,0.06)',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>[7] 명예의 전당 수동 수정</h3>
            <p style={{ fontSize: 12, marginBottom: 10, color: '#555' }}>
              사용자가 메달에 대해 이의를 제기했을 때, 연도·월·이름 기준으로 메달을 조정할 수 있습니다.
              수정 시 해당 사용자의 개인 메달 기록도 함께 반영됩니다.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <input
                type="number"
                value={manualHoFYear}
                onChange={(e) => setManualHoFYear(Number(e.target.value) || 0)}
                placeholder="연도(예: 2025)"
                style={{ width: 110, padding: 6, borderRadius: 8, border: '1px solid #ccc' }}
              />
              <input
                type="number"
                value={manualHoFMonth}
                onChange={(e) => {
                  const raw = Number(e.target.value) || 0;
                  const clamped = Math.min(12, Math.max(1, raw));
                  setManualHoFMonth(clamped);
                }}
                placeholder="월(1~12)"
                style={{ width: 80, padding: 6, borderRadius: 8, border: '1px solid #ccc' }}
              />
              <input
                type="text"
                value={manualHoFName}
                onChange={(e) => setManualHoFName(e.target.value)}
                placeholder="사용자 이름"
                style={{ flex: 1, minWidth: 120, padding: 6, borderRadius: 8, border: '1px solid #ccc' }}
              />
              <select
                value={manualHoFCrew}
                onChange={(e) => setManualHoFCrew(e.target.value)}
                style={{ width: 140, padding: 6, borderRadius: 8, border: '1px solid #ccc' }}
              >
                <option value="">반 선택</option>
                {CREW_KEYS.map(ck => (
                  <option key={ck} value={ck}>{getCrewLabel(ck)}</option>
                ))}
              </select>
              <select
                value={manualHoFMedal}
                onChange={(e) => setManualHoFMedal(e.target.value)}
                style={{ width: 120, padding: 6, borderRadius: 8, border: '1px solid #ccc' }}
              >
                <option value="gold">🥇 금</option>
                <option value="silver">🥈 은</option>
                <option value="bronze">🥉 동</option>
                <option value="none">메달 삭제</option>
              </select>
            </div>
            <button
              onClick={handleManualHallOfFameAdjust}
              disabled={manualHoFLoading}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: manualHoFLoading ? '#A8A8A8' : '#1D3557',
                color: '#fff',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              {manualHoFLoading ? '수정 중...' : '명예의 전당 수동 수정 저장'}
            </button>
          </div>

          {/* [10] 사용자별 체크 기록 강제 관리 추가 (그룹 3 내부) */}
          <div
            style={{
              marginBottom: 20,
              padding: 16,
              borderRadius: 12,
              background: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
              borderLeft: '5px solid #1D3557',
              marginTop: 24
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 10, color: '#1D3557' }}>[10] 사용자별 체크 기록 강제 관리</h3>
            <p style={{ fontSize: 12, marginBottom: 16, color: '#555' }}>
              관리자가 특정 성도의 과거 또는 현재 체크 사항을 강제로 수정할 수 있습니다.<br />
              <strong>성함의 일부를 입력하여 검색 후 선택</strong>해 주세요.
            </p>

            {/* 스마트 검색 시스템 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {/* 이름 검색창 */}
              <div style={{ position: 'relative', width: '100%', maxWidth: 350 }}>
                <input
                  type="text"
                  placeholder="🔍 성도 이름 검색 (예: 홍길동)"
                  value={adminCalSearchTerm}
                  onChange={e => setAdminCalSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 15px',
                    borderRadius: 8,
                    border: '1px solid #1D3557',
                    fontSize: 15,
                    background: '#fff',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
                  }}
                />
              </div>

              {/* 검색 결과 목록 */}
              <select
                value={selectedUser ? `${selectedUser.uid}|${adminCalCrew}` : ''}
                onChange={e => {
                  const val = e.target.value;
                  if (!val) return;
                  const [uid, ckey] = val.split('|');
                  handleSelectUser(uid, ckey);
                }}
                style={{
                  width: '100%',
                  maxWidth: 350,
                  padding: '10px',
                  borderRadius: 8,
                  border: '1px solid #1D3557',
                  fontSize: 14,
                  fontWeight: 'bold',
                  background: adminCalSearchTerm ? '#FFF9DB' : '#fff'
                }}
              >
                <option value="">{adminCalSearchTerm ? `-- '${adminCalSearchTerm}' 검색 결과 --` : '-- 검색어로 성도를 찾아주세요 --'}</option>
                {(() => {
                  const search = (adminCalSearchTerm || '').trim().toLowerCase();
                  if (!search) return null;

                  const matchingItems = [];
                  Object.entries(users || {}).forEach(([uid, u]) => {
                    if ((u.name || '').toLowerCase().includes(search)) {
                      const userCrews = CREW_KEYS.filter(ck => (approvalLists[ck] || []).includes(uid));
                      if (u.crew && !userCrews.includes(u.crew)) userCrews.push(u.crew);

                      if (userCrews.length === 0) matchingItems.push({ uid, name: u.name, crew: '미배정' });
                      else userCrews.forEach(ck => matchingItems.push({ uid, name: u.name, crew: ck }));
                    }
                  });

                  return matchingItems
                    .sort((a, b) => {
                      if (a.name !== b.name) return a.name.localeCompare(b.name);
                      return getCrewLabel(a.crew).localeCompare(getCrewLabel(b.crew));
                    })
                    .map((item, idx) => (
                      <option key={`${item.uid}_${item.crew}_${idx}`} value={`${item.uid}|${item.crew}`}>
                        {item.name} ({getCrewLabel(item.crew)})
                      </option>
                    ));
                })()}
              </select>
            </div>

            {!selectedUser ? (
              <div style={{ padding: '20px', textAlign: 'center', background: '#f8f9fa', borderRadius: 8, color: '#999' }}>
                성도를 선택하면 달력이 표시됩니다.
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: 15, color: '#1D3557' }}>👤 선택됨: {selectedUser.name} 성도</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select value={adminCalYear} onChange={e => setAdminCalYear(Number(e.target.value))} style={{ padding: 6, borderRadius: 8, border: '1px solid #ccc' }}>
                      {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년</option>)}
                    </select>
                    <select value={adminCalMonth} onChange={e => setAdminCalMonth(Number(e.target.value))} style={{ padding: 6, borderRadius: 8, border: '1px solid #ccc' }}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
                    </select>
                    <select value={adminCalCrew} onChange={e => setAdminCalCrew(e.target.value)} style={{ padding: 6, borderRadius: 8, border: '1px solid #ccc' }}>
                      <option value="">반 선택</option>
                      {CREW_KEYS.map(ck => <option key={ck} value={ck}>{getCrewLabel(ck)}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
                  gap: 8,
                  padding: 10,
                  background: '#f1f3f5',
                  borderRadius: 12
                }}>
                  {getMonthDates(adminCalYear, adminCalMonth).map(d => {
                    const isChecked = adminCalChecks[d];
                    const day = d.split('-')[2];
                    return (
                      <button
                        key={d}
                        onClick={() => handleToggleAdminCheck(d, isChecked)}
                        style={{
                          padding: '12px 0',
                          borderRadius: 8,
                          border: isChecked ? 'none' : '1px solid #dee2e6',
                          background: isChecked ? '#1D3557' : '#fff',
                          color: isChecked ? '#fff' : '#495057',
                          fontWeight: 'bold',
                          fontSize: 13,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {day}일
                        <div style={{ fontSize: 10, marginTop: 2, opacity: 0.8 }}>{isChecked ? 'V' : '-'}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'group4' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* [8] 월별 결과 보고서 */}
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: '#1D3557' }}>[8] 월별 결과 보고서 (과거 기록 조회)</h3>
              <button
                onClick={() => setShowMonthlyArchive(!showMonthlyArchive)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #1D3557',
                  background: showMonthlyArchive ? '#f1f1f1' : '#fff',
                  color: '#1D3557',
                  fontSize: 13,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {showMonthlyArchive ? '🔼 보관함 닫기' : '🔽 보관함 열기'}
              </button>
            </div>
            {!showMonthlyArchive && (
              <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
                과거의 월별 달리기 결과 및 명단 기록을 선택하여 확인할 수 있습니다.
              </p>
            )}

            {showMonthlyArchive && (
              <>
                <div style={{ marginTop: 16, marginBottom: 16 }}>
                  <label style={{ fontSize: 13, marginRight: 8 }}>보고서 선택:</label>
                  <select
                    value={selectedReportYM}
                    onChange={(e) => handleLoadReport(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ccc' }}
                  >
                    <option value="">-- 월 선택 --</option>
                    {reportMonths.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                {reportLoading && <p>데이터를 불러오는 중...</p>}

                {reportData && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                          <th style={{ padding: 10, textAlign: 'left' }}>반</th>
                          <th style={{ padding: 10, textAlign: 'left' }}>이름</th>
                          <th style={{ padding: 10, textAlign: 'center' }}>읽은 장수</th>
                          <th style={{ padding: 10, textAlign: 'center' }}>진행률</th>
                          <th style={{ padding: 10, textAlign: 'center' }}>상태</th>
                          <th style={{ padding: 10, textAlign: 'center' }}>누적 메달</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(reportData)
                          .sort((a, b) => a.crew.localeCompare(b.crew) || a.name.localeCompare(b.name))
                          .map((row) => (
                            <tr key={row.uid} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: 10 }}>{row.crew}</td>
                              <td style={{ padding: 10, fontWeight: 'bold' }}>{row.name}</td>
                              <td style={{ padding: 10, textAlign: 'center' }}>
                                {String(row.chapters).endsWith('장') ? row.chapters : `${row.chapters}일`}
                              </td>
                              <td style={{ padding: 10, textAlign: 'center' }}>{row.progress}%</td>
                              <td style={{ padding: 10, textAlign: 'center' }}>
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  color: '#fff',
                                  background: row.stateLabel === '성공' ? '#2E7D32' : row.stateLabel === '도전중' ? '#1E88E5' : '#D32F2F'
                                }}>
                                  {row.stateLabel}
                                </span>
                              </td>
                              <td style={{ padding: 10, textAlign: 'center' }}>{row.totalMedals}개</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 🏆 2026 연간 누적 보고서 (1독 달성 현황) */}
          <div
            style={{
              marginBottom: 20,
              padding: 16,
              borderRadius: 12,
              background: '#ffffff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ margin: 0, color: '#1D3557' }}>[9] 올해 누적 보고서 (성경 1독 현황)</h3>
                <select
                  value={selectedYearForReport}
                  onChange={(e) => {
                    const yr = Number(e.target.value);
                    setSelectedYearForReport(yr);
                    handleLoadYearlyReport(yr);
                  }}
                  style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #ccc', fontSize: 13 }}
                >
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}년</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleLoadYearlyReport()}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #457B9D',
                    background: '#fff',
                    color: '#457B9D',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  🔄 데이터 갱신
                </button>
                <button
                  onClick={() => setShowYearlyReport(!showYearlyReport)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #1D3557',
                    background: showYearlyReport ? '#f1f1f1' : '#fff',
                    color: '#1D3557',
                    fontSize: 12,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  {showYearlyReport ? '🔼 닫기' : '🔽 열기'}
                </button>
              </div>
            </div>

            {
              showYearlyReport && (
                <>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                    <button onClick={() => setYearlyFilter('all')} style={filterBtnStyle(yearlyFilter === 'all')}>전체 보기</button>
                    <button onClick={() => setYearlyFilter('full')} style={filterBtnStyle(yearlyFilter === 'full')}>📖 1독 이상 달성자</button>
                    {CREW_KEYS.map(ck => (
                      <button
                        key={ck}
                        onClick={() => setYearlyFilter(ck)}
                        style={filterBtnStyle(yearlyFilter === ck)}
                      >
                        {getCrewLabel(ck)} 완주자
                      </button>
                    ))}
                  </div>

                  {yearlyLoading ? <p>분석 중...</p> : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                            <th style={{ padding: 10, textAlign: 'left' }}>이름</th>
                            <th style={{ padding: 10, textAlign: 'center' }}>총 완주 반</th>
                            <th style={{ padding: 10, textAlign: 'center' }}>성경 1독</th>
                            <th style={{ padding: 10, textAlign: 'left', fontSize: 11, color: '#666' }}>상세 완주 내역</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredYearlyData.map((u) => (
                            <tr key={u.name} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: 10, fontWeight: 'bold' }}>{u.name}</td>
                              <td style={{ padding: 10, textAlign: 'center' }}>
                                {Object.values(u.crews).reduce((a, b) => a + b, 0)}개 반
                              </td>
                              <td style={{ padding: 10, textAlign: 'center' }}>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: 20,
                                  background: u.totalBible > 0 ? '#E9C46A' : '#f0f0f0',
                                  color: u.totalBible > 0 ? '#000' : '#888',
                                  fontWeight: 'bold',
                                  fontSize: 12
                                }}>
                                  🔥 {u.totalBible}독
                                </span>
                              </td>
                              <td style={{ padding: 10, fontSize: 11 }}>
                                {Object.entries(u.crews).map(([c, count]) => (
                                  <span key={c} style={{ marginRight: 8, display: 'inline-block' }}>
                                    {c}({count})
                                  </span>
                                ))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
          </div>
        </div>
      )}
      {/* 🔄 [11] 데이터 재집계 및 동기화 */}
      <div style={{ marginTop: 40, padding: 20, background: '#F0F9FF', border: '2px solid #3B82F6', borderRadius: 12 }}>
        <h3 style={{ color: '#1E40AF', margin: '0 0 10px 0' }}>🔄 [11] 데이터 재집계 및 동기화 (관리자 전용)</h3>
        <p style={{ fontSize: 13, color: '#1E3A8A', lineHeight: 1.5, marginBottom: 15 }}>
          데이터 수동 변경 후 누르면 메달, 보고서 등이 동기화됩니다.<br />
          (모든 승인 인원의 기록을 전수 조사하여 자격에 맞춰 메달을 지급/회수하고 랭킹을 갱신합니다.)
        </p>
        <button
          onClick={async () => {
            if (!window.confirm("🔄 전체 데이터를 재집계 하시겠습니까?\n(약간의 시간이 소요될 수 있습니다.)")) return;
            try {
              const msg = await runMedalFixOps();
              alert(msg);
              // 데이터 갱신을 위해 리로드
              handleLoadYearlyReport();
            } catch (e) {
              alert("동기화 실패: " + e.message);
            }
          }}
          style={{
            padding: '12px 24px',
            background: '#2563EB',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          🔄 데이터 재집계 실행
        </button>
      </div>
    </div>
  );
}

const filterBtnStyle = (active) => ({
  padding: '6px 12px',
  borderRadius: 20,
  border: '1px solid #457B9D',
  background: active ? '#457B9D' : '#fff',
  color: active ? '#fff' : '#457B9D',
  fontSize: 12,
  fontWeight: active ? 'bold' : 'normal',
  cursor: 'pointer',
});