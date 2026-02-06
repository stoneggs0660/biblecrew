
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

async function runAudit() {
    console.log("--- 🕵️ 메달/보고서([8],[9]) 정밀 감사 시뮬레이션 (샘플) ---");
    const baseUrl = "https://biblecrew-dev-default-rtdb.firebaseio.com";

    // Sample context
    const year = 2026;
    const targetMonths = [1, 2];
    const sampleUids = ["윤문식", "김", "테스트테스트"];

    // Simulation Data Store
    const simulationResults = {}; // { uid: { [ym]: { crew: medal } } }
    const yearlyAggregation = {}; // { uid: { totalMedals: 0, crews: { crew: count }, totalDok: 0 } }

    console.log("\n[분석 모드: 8번 월별 보고서 & 9번 연간 누적]");

    for (const m of targetMonths) {
        const ymKey = `${year}-${String(m).padStart(2, '0')}`;
        console.log(`\n📅 ${ymKey} 분석 진행...`);

        // [8번 조건용] 승인 데이터 가져오기
        const approvals = await getJSON(`${baseUrl}/approvals/${ymKey}.json`) || {};

        for (const uid of sampleUids) {
            if (!simulationResults[uid]) simulationResults[uid] = {};
            if (!yearlyAggregation[uid]) yearlyAggregation[uid] = { totalMedals: 0, crews: {}, totalDok: 0 };

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

                    console.log(`   ✅ ${uid}: [${crew}] 승인됨 & 완주 성공! (보고서8 등재 대상)`);
                } else {
                    console.log(`   ❌ ${uid}: [${crew}] 승인됨 & 미완주 (누락: ${missingDates.length}일)`);
                }
            }
        }
    }

    console.log("\n===========================================");
    console.log("📊 [8번 월별 보고서 샘플 출력]");
    console.log("===========================================");
    for (const m of targetMonths) {
        const ymKey = `${year}-${String(m).padStart(2, '0')}`;
        console.log(`\n[${ymKey} 보고서 명단]`);
        let found = false;
        for (const uid of sampleUids) {
            const res = simulationResults[uid][ymKey];
            if (res) {
                console.log(`- ${uid} | 반: ${res.crew} | 상태: 성공 | 획득메달: ${res.medal}`);
                found = true;
            }
        }
        if (!found) console.log("- 해당 월 성공자 없음 (샘플 기준)");
    }

    console.log("\n===========================================");
    console.log("🏆 [9번 올해 누적 보고서 샘플 출력]");
    console.log("===========================================");
    for (const uid of sampleUids) {
        const agg = yearlyAggregation[uid];
        const crewList = Object.entries(agg.crews).map(([c, count]) => `${c}(${count})`).join(', ');
        console.log(`- ${uid} | 총 완주: ${agg.totalMedals}회 | 상세: ${crewList || '없음'}`);
    }

    console.log("\n-------------------------------------------");
    console.log("※ 위 분석은 승인 데이터(approvals)를 연동한 시뮬레이션입니다.");
}

runAudit();
