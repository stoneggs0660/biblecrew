import { saveChurchName, saveAppDescription, saveBulletinUrl, subscribeToSettings } from '../firebaseSync';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  subscribeToCrewApprovals,
  addCrewApprovalName,
  addCrewApprovalNames,
  approveNextMonthApplicant,
  approveAllNextMonthApplicants,
  getNextYMKey,
  clearCrewApprovals,
  resetUserPassword,
  updateAdminPassword,
  subscribeToNotice,
  saveNotice,
  subscribeToNextMonthApplications,
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
} from '../firebaseSync';
import { calculateMonthlyRankingForMonth } from '../utils/rankingUtils';
import { getMonthDates } from '../utils/dateUtils';
import { getDailyBiblePortionByCrew } from '../utils/bibleUtils';
import { getTodayCrewState } from '../utils/crewStatusUtils';

export default function AdminPage() {
  const navigate = useNavigate();
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
  const [nextMonthApps, setNextMonthApps] = useState({});
  const [historyMonths, setHistoryMonths] = useState([]);
  const [selectedHistoryMonth, setSelectedHistoryMonth] = useState('');
  const [historyApps, setHistoryApps] = useState({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const [manualHoFName, setManualHoFName] = useState('');
  const [manualHoFYear, setManualHoFYear] = useState(new Date().getFullYear());
  const [manualHoFMonth, setManualHoFMonth] = useState(new Date().getMonth() + 1);
  const [manualHoFMedal, setManualHoFMedal] = useState('gold');
  const [manualHoFLoading, setManualHoFLoading] = useState(false);
  const ymKey = getCurrentYMKey();
  const nextYmKey = getNextYMKey();

  const [reportMonths, setReportMonths] = useState([]);
  const [selectedReportYM, setSelectedReportYM] = useState('');
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const [yearlyData, setYearlyData] = useState([]);
  const [yearlyLoading, setYearlyLoading] = useState(false);
  const [yearlyFilter, setYearlyFilter] = useState('all'); // all, full, advanced, intermediate...

  const [selectedYearForReport, setSelectedYearForReport] = useState(new Date().getFullYear());
  const [showMonthlyArchive, setShowMonthlyArchive] = useState(false);
  const [showYearlyReport, setShowYearlyReport] = useState(false);

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
    Object.entries(crews || {}).forEach(([crew, crewNode]) => {
      const usersNode = crewNode && crewNode.users;
      if (!usersNode) return;
      Object.entries(usersNode).forEach(([uid, u]) => {
        const checks = (u && u.checks) || {};
        let readChapters = 0;
        let requiredChapters = 0;
        let allCovered = true;
        uptoDates.forEach((d) => {
          const portion = portionByCrewAndDate[crew] && portionByCrewAndDate[crew][d];
          if (portion && typeof portion.chapters === 'number') {
            requiredChapters += portion.chapters;
            if (checks[d]) {
              readChapters += portion.chapters;
            } else {
              allCovered = false;
            }
          }
        });
        const info = users && users[uid] ? users[uid] : {};
        const name = info.name || uid;
        const progress = requiredChapters > 0 ? Math.round((readChapters / requiredChapters) * 100) : 0;
        const state = getTodayCrewState({
          dates,
          todayKey,
          userChecks: checks,
          userDailyActivity: info.dailyActivity || {},
        });
        status[crew].push({
          uid,
          name,
          chapters: readChapters,
          progress,
          stateKey: state.key,
          stateLabel: state.label,
        });
      });
    });
    Object.keys(status).forEach((crew) => {
      status[crew].sort((a, b) => b.chapters - a.chapters);
    });
    setCrewStatus(status);
  }, [crews, users]);



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
    const unsub = subscribeToNextMonthApplications((data) => {
      setNextMonthApps(data || {});
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [])
  useEffect(() => {
    // 관리자 모드 진입 시 최근 3개월 신청 기록 로드 및 오래된 기록 정리
    async function loadHistory() {
      try {
        const months = await getRecentApplicationMonths(3);
        setHistoryMonths(months || []);
        setHistoryError('');

        if (months && months.length > 0) {
          const initial = months[0];
          setSelectedHistoryMonth(initial);
          setHistoryLoading(true);
          const data = await fetchApplicationsByMonth(initial);
          setHistoryApps(data || {});
        } else {
          setSelectedHistoryMonth('');
          setHistoryApps({});
        }
      } catch (err) {
        console.error('신청 기록 로드 오류', err);
        setHistoryError('신청 기록을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setHistoryLoading(false);
      }
    }

    loadHistory();
  }, []);

  async function handleChangeHistoryMonth(e) {
    const ym = e.target.value;
    setSelectedHistoryMonth(ym);
    if (!ym) {
      setHistoryApps({});
      return;
    }
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const data = await fetchApplicationsByMonth(ym);
      setHistoryApps(data || {});
    } catch (err) {
      console.error('신청 기록 로드 오류', err);
      setHistoryError('신청 기록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setHistoryLoading(false);
    }
  }



  useEffect(() => {
    const unsubUsers = subscribeToUsers(setUsers);
    const unsubCrews = subscribeToAllCrewChecks(setCrews);
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
      if (typeof unsubCrews === 'function') unsubCrews();
      if (typeof unsubNotice === 'function') unsubNotice();
      if (checksUnsubRef.current) {
        try { checksUnsubRef.current(); } catch (e) { }
        checksUnsubRef.current = null;
      }
    };
  }, []);
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



  const userList = Object.entries(users || {}).map(([uid, u]) => ({
    uid,
    ...u,
  }));


  function handleAddApproval(crew) {
    const input = (approvalInput[crew] || '').trim();
    if (!input) return;

    // 여러 이름(띄어쓰기/줄바꿈) 한번에 추가 가능
    addCrewApprovalNames(crew, ymKey, input).then(() => {
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

  function handleClearApproval(crew) {
    if (!window.confirm(`${crew} 승인 목록을 모두 삭제하시겠습니까? (이번 달 승인 정보만 삭제됩니다.)`)) return;
    clearCrewApprovals(crew, ymKey);
  }

  function handleSelectUser(uid) {
    const u = users[uid];

    // 이전 선택 사용자 체크 구독 해제 (리스너 누적 방지)
    if (checksUnsubRef.current) {
      try { checksUnsubRef.current(); } catch (e) { }
      checksUnsubRef.current = null;
    }

    setSelectedUser({ uid, ...u });

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
    if (!ok) return;
    try {
      const res = await cleanupOldComments(3);
      alert(`정리 완료: ${res?.deleted || 0}개 삭제되었습니다.`);
    } catch (e) {
      console.error('소감 정리 오류', e);
      alert('정리 중 오류가 발생했습니다. 콘솔을 확인해 주세요.');
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
    saveMonthlyHallOfFame(year, month, ranking).then(() => {
      alert(`${year}년 ${month}월 명예의 전당이 확정되었습니다.`);
    });
  }



  async function handleManualHallOfFameAdjust() {
    if (!manualHoFName || !manualHoFYear || !manualHoFMonth) {
      alert('연도, 월, 이름을 모두 입력해 주세요.');
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
      const ok = await adminSetMonthlyUserMedal(manualHoFYear, safeMonth, uid, manualHoFMedal);
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
    try {
      const data = await fetchMonthlyReport(ym);
      setReportData(data);
    } catch (e) {
      console.error(e);
      alert('보고서를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setReportLoading(false);
    }
  }

  async function handleSaveCurrentReport() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;

    if (!window.confirm(`${key} 월의 현재 진행 현황을 최종 보고서로 저장하시겠습니까?\n이미 저장된 경우 덮어씌워집니다.`)) return;

    // 현재 crewStatus 기반으로 리포트 데이터 생성
    const reportPayload = {};
    Object.entries(crewStatus).forEach(([crew, members]) => {
      members.forEach((m) => {
        const userMedals = users[m.uid]?.medals || {};
        const totalMedals = (userMedals.gold || 0) + (userMedals.silver || 0) + (userMedals.bronze || 0);

        reportPayload[m.uid] = {
          uid: m.uid,
          name: m.name,
          crew: crew,
          chapters: m.chapters,
          progress: m.progress,
          stateLabel: m.stateLabel, // 성공, 실패 등
          totalMedals: totalMedals
        };
      });
    });

    try {
      await saveMonthlyReport(year, month, reportPayload);
      alert(`${key} 월 보고서가 저장되었습니다.`);
      // 목록 갱신
      const updatedMonths = await getMonthlyReportMonths();
      setReportMonths(updatedMonths);
    } catch (e) {
      console.error(e);
      alert('보고서 저장 중 오류가 발생했습니다.');
    }
  }

  // ✅ 연간 누적 데이터 계산 및 로드
  async function handleLoadYearlyReport(targetYear) {
    const year = targetYear || selectedYearForReport;
    setYearlyLoading(true);
    try {
      const allMonths = await getYearlyHallOfFame(year); // { "01": { gold: [...], ... }, "02": ... }

      const userSummary = {}; // { name: { countInfo, bibleReads } }

      Object.entries(allMonths).forEach(([month, medals]) => {
        ['gold', 'silver', 'bronze'].forEach(mKey => {
          (medals[mKey] || []).forEach(entry => {
            const name = entry.name;
            const crew = entry.crew;
            if (!userSummary[name]) {
              userSummary[name] = {
                name,
                crews: {},
                totalBible: 0,
                // 계산용 카운트
                cnt: { adv: 0, int: 0, nt: 0, ota: 0, otb: 0 }
              };
            }

            // 반별 카운트 증가
            userSummary[name].crews[crew] = (userSummary[name].crews[crew] || 0) + 1;

            // 1독 계산용 매핑
            if (crew === '고급반') userSummary[name].cnt.adv++;
            if (crew === '중급반') userSummary[name].cnt.int++;
            if (crew === '초급반') userSummary[name].cnt.nt++;
            if (crew === '초급반(구약A)') userSummary[name].cnt.ota++;
            if (crew === '초급반(구약B)') userSummary[name].cnt.otb++;
          });
        });
      });

      // 1독(Bible Reads) 최종 계산
      const processedList = Object.values(userSummary).map(u => {
        let bibleCount = 0;
        let ntPool = u.cnt.nt;

        // 1. 고급반은 무조건 +1독
        bibleCount += u.cnt.adv;

        // 2. 중급반 + 신약초급반 세트
        const intSets = Math.min(u.cnt.int, ntPool);
        bibleCount += intSets;
        ntPool -= intSets;

        // 3. 구약A + 구약B + 신약초급반 세트
        const otSets = Math.min(u.cnt.ota, u.cnt.otb, ntPool);
        bibleCount += otSets;

        return { ...u, totalBible: bibleCount };
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
    .filter(([uid, u]) => u && !u.crew && (u.status || 'active') !== 'inactive')
    .map(([uid, u]) => ({ uid, ...u }));

  const inactiveUsers = Object.entries(users || {})
    .filter(([uid, u]) => u && (u.status || '') === 'inactive')
    .map(([uid, u]) => ({ uid, ...u }));

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

      {/* 반 안내팝업 전용 편집 페이지 */}
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
        <h3 style={{ marginBottom: 8, color: '#1D3557' }}>앱 기본 설정</h3>
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
          <h4 style={{ marginBottom: 6, color: '#1D3557' }}>관리자 비밀번호</h4>
          <p style={{ fontSize: 12, marginBottom: 6 }}>
            현재 저장된 관리자 비밀번호를 변경할 수 있습니다. (마스터 비밀번호 8395는 항상 유효합니다.)
          </p>
          <button
            type='button'
            onClick={handleChangeAdminPassword}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: 'none',
              background: '#264653',
              color: '#fff',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            관리자 비밀번호 변경
          </button>
        </div>
      </div>

      {/* 승인 관리 */}
      <div
        style={{
          marginBottom: 20,
          padding: 16,
          borderRadius: 12,
          background: '#FFFFFF',
          boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
        }}
      >
        <h3 style={{ marginBottom: 8, color: '#1D3557' }}>승인 관리</h3>
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

        <div style={{ fontSize: 11, color: '#777', marginTop: 8 }}>
          * 승인 목록은 매달 새롭게 관리됩니다. 승인에서 제외되어도 개인 기록과 명예의 전당 기록은 유지됩니다.
        </div>

        {/* 비활성(삭제) 명단 */}
        <div style={{ marginTop: 18 }}>
          <h4 style={{ marginBottom: 6 }}>비활성(삭제) 명단</h4>
          {(!inactiveUsers || inactiveUsers.length === 0) && (
            <p style={{ fontSize: 12, color: '#666' }}>비활성 사용자가 없습니다.</p>
          )}
          {inactiveUsers && inactiveUsers.length > 0 && (
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

      {/* 다음 달 크루 신청자 목록 */}
      <div
        style={{
          marginBottom: 20,
          padding: 16,
          borderRadius: 12,
          background: '#FFFFFF',
          boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
        }}
      >
        <h3 style={{ marginBottom: 8, color: '#1D3557' }}>다음 달 크루 신청자 목록</h3>
        <p style={{ fontSize: 12, marginBottom: 12, color: '#555' }}>
          다음 달에 신청된 크루 명단입니다. <strong>관리자는 명단을 수동 승인 하시기 바랍니다.</strong>
        </p>

        {CREW_KEYS.map((crew) => {
          const crewNode = (nextMonthApps && nextMonthApps[crew]) || {};
          const entries = Object.entries(crewNode || {})
            .map(([k, v]) => ({ key: k, name: (v && v.name) || k }))
            .filter((it) => it.name && it.name.toString().trim().length > 0);

          const displayNames = entries.map((it) => (it.name || '').toString().trim()).filter(Boolean);

          async function handleApproveOne(appKey) {
            try {
              await approveNextMonthApplicant(nextYmKey, crew, appKey);
            } catch (err) {
              alert(err && err.message ? err.message : '승인 처리 중 오류가 발생했습니다.');
            }
          }

          async function handleApproveAll() {
            try {
              await approveAllNextMonthApplicants(nextYmKey, crew);
            } catch (err) {
              alert(err && err.message ? err.message : '전체 승인 처리 중 오류가 발생했습니다.');
            }
          }

          return (
            <div key={crew} style={{ marginBottom: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ fontWeight: 'bold' }}>{getCrewLabel(crew)}</div>

                <button
                  type='button'
                  onClick={handleApproveAll}
                  disabled={entries.length === 0}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    border: '1px solid #2a9d8f',
                    background: entries.length === 0 ? '#f3f3f3' : '#2a9d8f',
                    color: entries.length === 0 ? '#999' : '#fff',
                    cursor: entries.length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                  }}
                  title='현재 목록에 있는 신청자를 모두 승인합니다.'
                >
                  전체 승인
                </button>
              </div>

              {entries.length === 0 && <div style={{ color: '#777' }}>신청자가 없습니다.</div>}

              {entries.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {entries.map((it) => (
                    <div
                      key={it.key}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        border: '1px solid #ddd',
                        borderRadius: 999,
                        background: '#fafafa',
                      }}
                    >
                      <span>{(it.name || '').toString().trim()}</span>
                      <button
                        type='button'
                        onClick={() => handleApproveOne(it.key)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: '1px solid #457B9D',
                          background: '#457B9D',
                          color: '#fff',
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                        title='이 신청자만 승인합니다.'
                      >
                        승인
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 지난달 및 최근 신청자 기록 (최대 3개월) */}
      <div
        style={{
          marginBottom: 20,
          padding: 16,
          borderRadius: 12,
          background: '#FFFFFF',
          boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
        }}
      >
        <h3 style={{ marginBottom: 8, color: '#1D3557' }}>지난달 신청자 기록 (최근 3개월)</h3>
        <p style={{ fontSize: 12, marginBottom: 12, color: '#555' }}>
          지난 달까지 신청되었던 크루 명단을 확인할 수 있습니다. <strong>최대 최근 3개월까지만 보관됩니다.</strong>
        </p>

        {historyMonths.length === 0 && (
          <div style={{ fontSize: 13, color: '#777' }}>
            최근 3개월 이내 신청 기록이 없습니다.
          </div>
        )}

        {historyMonths.length > 0 && (
          <>
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13 }}>조회할 달 선택:</span>
              <select
                value={selectedHistoryMonth}
                onChange={handleChangeHistoryMonth}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid #ccc',
                  fontSize: 13,
                }}
              >
                {historyMonths.map((ym) => (
                  <option key={ym} value={ym}>
                    {ym}
                  </option>
                ))}
              </select>
            </div>

            {historyLoading && (
              <div style={{ fontSize: 12, color: '#777' }}>불러오는 중...</div>
            )}

            {historyError && (
              <div style={{ fontSize: 12, color: '#E63946' }}>{historyError}</div>
            )}

            {!historyLoading && !historyError && selectedHistoryMonth && (
              <div style={{ marginTop: 8 }}>
                {CREW_KEYS.map((crew) => {
                  const crewNode = (historyApps && historyApps[crew]) || {};
                  const names = Object.values(crewNode || {})
                    .map((v) => v && v.name)
                    .filter((n) => n && n.trim().length > 0);

                  return (
                    <div key={crew} style={{ marginBottom: 8, fontSize: 13 }}>
                      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{getCrewLabel(crew)}</div>
                      {names.length === 0 && (
                        <div style={{ color: '#777' }}>신청자가 없습니다.</div>
                      )}
                      {names.length > 0 && <div>{names.join(', ')}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {CREW_KEYS.map((crewKey) => (
            <button
              key={crewKey}
              onClick={() => handleClearCrewCommentsClick(crewKey)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: 'none',
                background: '#E63946',
                color: '#fff',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
              title="해당 반 소감 전체(영구)삭제"
            >
              {getCrewLabel(crewKey)} 소감 삭제
            </button>
          ))}
          <button
            onClick={handleClearCommentsClick}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#B91C1C',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginLeft: 4,
            }}
            title="모든 반 소감 전체(영구)삭제"
          >
            전체 소감 삭제
          </button>

          <button
            onClick={handleCleanupOldCommentsClick}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #0B8457',
              background: '#fff',
              color: '#0B8457',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
            title="3일 지난 소감을 정리(영구 삭제)"
          >
            3일 지난 소감 정리
          </button>
        </div>
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
            marginRight: 8,
          }}
        >
          지난달 명예의 전당 수동확정
        </button>
      </div>


      {/* 크루 달리기 & 비번 초기화 / 미배정 명단 */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          borderRadius: 12,
          background: '#FFFFFF',
          boxShadow: '0 4px 10px rgba(0,0,0,0.06)',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 10 }}>이번 달 크루 달리기 현황</h3>
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

        {/* 미배정 명단 */}
        <div style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 6 }}>미배정 명단</h4>
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
                          background: '#E53935',
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
        <h3 style={{ marginTop: 0, marginBottom: 10 }}>명예의 전당 수동 수정</h3>
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
            value={manualHoFMedal}
            onChange={(e) => setManualHoFMedal(e.target.value)}
            style={{ width: 140, padding: 6, borderRadius: 8, border: '1px solid #ccc' }}
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

      {/* 📊 월별 결과 보고서 */}
      <div
        style={{
          marginBottom: 20,
          padding: 16,
          borderRadius: 12,
          background: '#FFFFFF',
          boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, color: '#1D3557' }}>📊 월별 결과 보고서 (아카이브)</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSaveCurrentReport}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: '#2A9D8F',
                color: '#fff',
                fontSize: 13,
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              🏁 현재 현황을 보고서로 저장
            </button>
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
              {showMonthlyArchive ? '🔼 닫기' : '🔽 열기'}
            </button>
          </div>
        </div>

        {showMonthlyArchive && (
          <>
            <div style={{ marginBottom: 16 }}>
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
                          <td style={{ padding: 10, textAlign: 'center' }}>{row.chapters}장</td>
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
            <h3 style={{ margin: 0, color: '#1D3557' }}>🏆 올해 누적 보고서 (성경 1독 현황)</h3>
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

        {showYearlyReport && (
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