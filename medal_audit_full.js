
// Logic copied/simplified from rankingUtils.js, bibleUtils.js, and dokUtils.js
const CREW_KEYS = ['고급반', '중급반', '초급반(구약A)', '초급반(구약B)', '초급반', '구약파노라마', '신약파노라마'];

function getMonthDates(year, month) {
    const lastDay = new Date(year, month, 0).getDate();
    const dates = [];
    for (let d = 1; d <= lastDay; d++) {
        dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return dates;
}

async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
}

// 1독 계산 로직 (간소화)
function calculateDokStatusSimplified(earnedMedals) {
    // earnedMedals: { '2026-01_고급반': 'gold', ... }
    const items = Object.entries(earnedMedals || {}).map(([k, v]) => {
        const parts = k.split('_');
        return { crew: parts[1], medal: v };
    });

    let advCount = 0;
    let interCount = 0;
    let basicSet = { otA: 0, otB: 0, nt: 0 };

    items.forEach(it => {
        if (it.crew === '고급반') advCount++;
        else if (it.crew === '중급반') interCount++;
        else if (it.crew === '초급반(구약A)') basicSet.otA++;
        else if (it.crew === '초급반(구약B)') basicSet.otB++;
        else if (it.crew && (it.crew === '초급반' || it.crew.includes('파노라마'))) basicSet.nt++;
    });

    // 1독 계산
    // 1순위: 고급반 = 1독
    let totalDok = advCount;

    // 2순위: 중급반 + 신약(초급/파노라마) = 1독
    const dokFromInter = Math.min(interCount, basicSet.nt);
    totalDok += dokFromInter;
    let remainNt = basicSet.nt - dokFromInter; // 남은 신약

    // 3순위: 구약A + 구약B + 신약 = 1독
    const dokFromBasic = Math.min(basicSet.otA, basicSet.otB, remainNt);
    totalDok += dokFromBasic;

    return totalDok;
}


async function runFullAudit() {
    console.log("--- 🕵️ [전체 성도] 메달 및 8,9번 보고서 전수 조사 시뮬레이션 ---");
    const baseUrl = "https://biblecrew-dev-default-rtdb.firebaseio.com";

    const year = 2026;
    const targetMonths = [1, 2];

    // 1. 전체 유저 목록 가져오기
    console.log("📥 사용자 목록 다운로드 중...");
    const usersMap = await getJSON(`${baseUrl}/users.json`) || {};
    const allUids = Object.keys(usersMap);
    console.log(`   총 ${allUids.length}명의 사용자 발견`);

    // Simulation Data Store
    const simulationResults = {}; // { uid: { [ym]: { crew: medal } } }
    const yearlyAggregation = {}; // { uid: { totalMedals: 0, crews: { crew: count }, totalDok: 0 } }
    const earnedMedalSimulStore = {}; // { uid: { 'YYYY-MM_Crew': medal } } - 1독 계산용

    // 초기화
    allUids.forEach(uid => {
        simulationResults[uid] = {};
        yearlyAggregation[uid] = { name: usersMap[uid].name, totalMedals: 0, crews: {}, totalDok: 0 };
        earnedMedalSimulStore[uid] = {};
    });

    console.log("\n[분석 모드: 8번 월별 보고서 & 9번 연간 누적 & 1독 계산]");

    for (const m of targetMonths) {
        const ymKey = `${year}-${String(m).padStart(2, '0')}`;
        console.log(`\n📅 ${ymKey} 데이터 정밀 분석 중... (${allUids.length}명 대조)`);

        // [8번 조건용] 승인 데이터 가져오기
        const approvals = await getJSON(`${baseUrl}/approvals/${ymKey}.json`) || {};

        for (const uid of allUids) {
            for (const crew of CREW_KEYS) {
                // [8번 제약]: 해당 월에 승인된 반에 한해서만 조사
                const isApproved = approvals[crew] && approvals[crew][uid];
                if (!isApproved) continue;

                // 진도 대조
                const dates = getMonthDates(year, m);
                const crewChecks = await getJSON(`${baseUrl}/crews/${crew}/users/${uid}/checks.json`) || {};

                const missingDates = dates.filter(d => !crewChecks[d]);
                const isSuccess = missingDates.length === 0;

                if (isSuccess) {
                    let medalType = 'bronze';
                    if (crew === '고급반') medalType = 'gold';
                    else if (crew === '중급반') medalType = 'silver';

                    simulationResults[uid][ymKey] = { crew, medal: medalType };

                    // [9번 누적용]
                    yearlyAggregation[uid].totalMedals += 1;
                    yearlyAggregation[uid].crews[crew] = (yearlyAggregation[uid].crews[crew] || 0) + 1;

                    // [1독 계산용 저장소]
                    const awardKey = `${ymKey}_${crew}`;
                    earnedMedalSimulStore[uid][awardKey] = medalType;
                }
            }
        }
    }

    // [1독 계산]
    allUids.forEach(uid => {
        const dokCount = calculateDokStatusSimplified(earnedMedalSimulStore[uid]);
        yearlyAggregation[uid].totalDok = dokCount;
    });


    console.log("\n===========================================");
    console.log("📊 [8번 월별 보고서 시뮬레이션 결과]");
    console.log("===========================================");
    for (const m of targetMonths) {
        const ymKey = `${year}-${String(m).padStart(2, '0')}`;
        console.log(`\n[${ymKey} 보고서 성공 명단]`);

        let count = 0;
        for (const uid of allUids) {
            const res = simulationResults[uid][ymKey];
            if (res) {
                console.log(`- ${usersMap[uid].name}(${res.crew}): 획득(${res.medal})`);
                count++;
            }
        }
        if (count === 0) console.log("- 성공자 없음");
    }

    console.log("\n===========================================");
    console.log("🏆 [9번 올해 누적 보고서 시뮬레이션 결과]");
    console.log("===========================================");
    let hasRecord = false;
    for (const uid of allUids) {
        const agg = yearlyAggregation[uid];
        if (agg.totalMedals > 0) {
            const crewList = Object.entries(agg.crews).map(([c, count]) => `${c}(${count})`).join(', ');
            console.log(`\n👤 ${agg.name}`);
            console.log(`   - 총 메달: ${agg.totalMedals}개`);
            console.log(`   - 1독 달성: ${agg.totalDok}독`);
            console.log(`   - 상세 내역: ${crewList}`);
            hasRecord = true;
        }
    }
    if (!hasRecord) console.log("- 올해 완주 기록이 있는 사용자가 없습니다.");

    console.log("\n-------------------------------------------");
    console.log("※ 위 결과는 전체 사용자의 실제 진도(checks)를 전수 조사하여 생성되었습니다.");
}

runFullAudit();
