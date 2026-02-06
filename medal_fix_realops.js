
// Logic copied/simplified from rankingUtils.js, bibleUtils.js, and dokUtils.js
import { getDatabase, ref, get, set, update } from "firebase/database";
import { initializeApp } from "firebase/app";

// Firebase Config (Dev)
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

// Hardcoded for script execution context if env vars are missing
// Hardcoded for script execution context if env vars are missing
const HARDCODED_CONFIG = {
    // ⚡️ PRODUCTION DB URL (CAUTION: REAL DATA MODIFICATION)
    databaseURL: "https://biblecrew-e14f3.firebaseio.com",
};

const app = initializeApp(firebaseConfig.databaseURL ? firebaseConfig : HARDCODED_CONFIG);
const db = getDatabase(app);

const CREW_KEYS = ['고급반', '중급반', '초급반(구약A)', '초급반(구약B)', '초급반', '구약파노라마', '신약파노라마'];

function getMonthDates(year, month) {
    const lastDay = new Date(year, month, 0).getDate();
    const dates = [];
    for (let d = 1; d <= lastDay; d++) {
        dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return dates;
}

async function runFix() {
    console.log("--- 🛠️ [실제 실행] 메달/보고서 데이터 일괄 복구 및 정제(Fix) ---");

    const year = 2026;
    const targetMonths = [1, 2]; // 1, 2월 대상으로 조사

    // 1. 전체 유저 목록 가져오기
    console.log("📥 [1/4] 사용자 목록 로딩 중...");
    const usersRef = ref(db, 'users');
    const usersSnap = await get(usersRef);
    const usersMap = usersSnap.val() || {};
    const allUids = Object.keys(usersMap);
    console.log(`   총 ${allUids.length}명 대상`);

    // 복구할 데이터 (메달 이력)
    // earnedMedalStore: { uid: { 'YYYY-MM_Crew': 'gold' } }
    const earnedMedalStore = {};
    const medalCounts = {}; // { uid: { gold:0, silver:0, bronze:0 } }

    // 명예의 전당 데이터 (월별 결과)
    // hofMonthly: { 'YYYY-MM': { gold: [], silver: [], bronze: [], dokAchievers: [] } }
    const hofMonthly = {};

    // 1독 계산 로직 (간소화)
    function calculateDokStatus(earnedMedals) {
        const items = Object.entries(earnedMedals || {}).map(([k, v]) => {
            const parts = k.split('_');
            return { crew: parts[1], medal: v, key: k };
        });
        let adv = 0, inter = 0, basic = { otA: 0, otB: 0, nt: 0 };
        items.forEach(it => {
            if (it.crew === '고급반') adv++;
            else if (it.crew === '중급반') inter++;
            else if (it.crew === '초급반(구약A)') basic.otA++;
            else if (it.crew === '초급반(구약B)') basic.otB++;
            else if (it.crew.includes('파노라마') || it.crew === '초급반') basic.nt++;
        });
        let total = adv;
        const fromInter = Math.min(inter, basic.nt);
        total += fromInter;
        const remainNt = basic.nt - fromInter;
        total += Math.min(basic.otA, basic.otB, remainNt);
        return total;
    }

    // 초기화
    allUids.forEach(uid => {
        earnedMedalStore[uid] = {};
        medalCounts[uid] = { gold: 0, silver: 0, bronze: 0 };
    });

    console.log("\n📥 [2/4] 진도표(checks) 전수 조사 및 메달 재판정...");

    for (const m of targetMonths) {
        const mm = String(m).padStart(2, '0');
        const ymKey = `${year}-${mm}`;

        // 해당 월 명예의 전당 초기화
        hofMonthly[ymKey] = { gold: [], silver: [], bronze: [], dokAchievers: [] };

        // 승인 목록 가져오기
        const appRef = ref(db, `approvals/${ymKey}`);
        const appSnap = await get(appRef);
        const approvals = appSnap.val() || {};

        for (const uid of allUids) {
            for (const crew of CREW_KEYS) {
                // 승인 여부 체크
                if (!approvals[crew] || !approvals[crew][uid]) continue;

                // 진도 체크
                const crewCheckRef = ref(db, `crews/${crew}/users/${uid}/checks`);
                const checkSnap = await get(crewCheckRef);
                const checks = checkSnap.val() || {};

                const dates = getMonthDates(year, m);
                const isSuccess = dates.every(d => checks[d]);

                if (isSuccess) {
                    let medalType = 'bronze';
                    if (crew === '고급반') medalType = 'gold';
                    else if (crew === '중급반') medalType = 'silver';

                    // 1. 개인 이력 저장소에 추가
                    const awardKey = `${ymKey}_${crew}`;
                    earnedMedalStore[uid][awardKey] = medalType;

                    // 2. 개인 메달 카운트 증가
                    medalCounts[uid][medalType]++;

                    // 3. 명예의 전당(월별) 명단에 추가
                    const uMeta = usersMap[uid];
                    hofMonthly[ymKey][medalType].push({
                        name: uMeta.name || '이름없음',
                        crew: crew
                    });

                    // console.log(`   ✅ ${uMeta.name} (${year}-${m} ${crew}) -> ${medalType} 확정`);
                }
            }
        }
    }

    console.log("\n💾 [3/4] DB 일괄 업데이트 실행...");
    const updates = {};

    // 1. 개인 데이터 (earnedMedals 및 medals 카운트) 덮어쓰기
    for (const uid of allUids) {
        // 기존 데이터 삭제 후 재설정 효과를 위해 전체 객체 덮어쓰기
        // (null 처리된 부분은 삭제됨)

        // earnedMedals가 비어있으면 null 저장 (삭제)
        const newEarned = Object.keys(earnedMedalStore[uid]).length > 0 ? earnedMedalStore[uid] : null;
        updates[`users/${uid}/earnedMedals`] = newEarned;

        // medals 카운트도 재계산된 값으로 강제 동기화
        updates[`users/${uid}/medals`] = medalCounts[uid];
    }

    // 2. 명예의 전당 (월별 결과) 덮어쓰기
    for (const m of targetMonths) {
        const mm = String(m).padStart(2, '0');
        const ymKey = `${year}-${mm}`;
        const result = hofMonthly[ymKey];

        // hallOfFame/{year}/monthlyResults/{mm}/{medal}
        updates[`hallOfFame/${year}/monthlyResults/${mm}/gold`] = result.gold;
        updates[`hallOfFame/${year}/monthlyResults/${mm}/silver`] = result.silver;
        updates[`hallOfFame/${year}/monthlyResults/${mm}/bronze`] = result.bronze;

        // 1독 달성자 재계산 (이번 달 완주로 인해 달성한 사람)
        // 로직: 이번 달까지의 전체 완독 수 > 지난달까지의 전체 완독 수 인 경우
        const achievers = [];

        // 지난달까지의 이력 임시 계산
        // (복잡도를 줄이기 위해, 이번 달 완주자들만 대상으로 검사)
        const candidates = new Set([
            ...result.gold.map(x => x.name),
            ...result.silver.map(x => x.name),
            ...result.bronze.map(x => x.name)
        ]);

        // 이름 -> UID 매핑 (동명이인 이슈가 있지만 여기선 단순 매칭 시도)
        const nameToUid = {};
        Object.entries(usersMap).forEach(([u, v]) => nameToUid[v.name] = u);

        candidates.forEach(name => {
            const uid = nameToUid[name];
            if (!uid) return;

            const currentTotalDok = calculateDokStatus(earnedMedalStore[uid]);

            // 지난달까지의 이력만 필터링
            // earnedMedalStore[uid] 에서 ymKey를 포함하거나 이후인 키를 제외
            const prevHistory = {};
            Object.entries(earnedMedalStore[uid]).forEach(([k, v]) => {
                const [kYm] = k.split('_');
                if (kYm < ymKey) prevHistory[k] = v;
            });
            const prevTotalDok = calculateDokStatus(prevHistory);

            if (currentTotalDok > prevTotalDok) {
                achievers.push({ name: name, dokCount: currentTotalDok });
            }
        });

        updates[`hallOfFame/${year}/monthlyResults/${mm}/dokAchievers`] = achievers;
    }

    console.log(`   총 ${Object.keys(updates).length}개 경로 업데이트 준비 완료.`);

    // 실행
    await update(ref(db), updates);
    console.log("✅ [4/4] 업데이트 완료! 모든 데이터가 정상화되었습니다.");
    process.exit(0);
}

runFix();
