
// Logic copied/simplified from rankingUtils.js and bibleUtils.js
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
    return res.json();
}

async function runAudit() {
    console.log("--- 🕵️ 메달 획득 정밀 감사 시뮬레이션 (샘플) ---");
    const baseUrl = "https://biblecrew-dev-default-rtdb.firebaseio.com";

    // Sample users
    const sampleUids = ["윤문식", "김", "테스트테스트"];
    const targetMonths = [{ y: 2026, m: 1 }, { y: 2026, m: 2 }];

    for (const uid of sampleUids) {
        console.log(`\n👤 성도명: ${uid}`);
        const user = await getJSON(`${baseUrl}/users/${uid}.json`);
        if (!user) { console.log("   (데이터 없음)"); continue; }

        const actualMedals = user.medals || { gold: 0, silver: 0, bronze: 0 };
        const earnedMedals = user.earnedMedals || {};

        console.log(`   [현재 기록] 누적: 🥇${actualMedals.gold} 🥈${actualMedals.silver} 🥉${actualMedals.bronze}`);
        console.log(`   [현재 이력] ${Object.keys(earnedMedals).join(', ') || '없음'}`);

        for (const { y, m } of targetMonths) {
            const dates = getMonthDates(y, m);
            console.log(`   📅 ${y}년 ${m}월 분석:`);

            for (const crew of CREW_KEYS) {
                const crewChecks = await getJSON(`${baseUrl}/crews/${crew}/users/${uid}/checks.json`);
                if (!crewChecks) continue;

                // Rule: For historical months, 100% completion check
                const missingDates = dates.filter(d => !crewChecks[d]);
                const isSuccess = missingDates.length === 0;

                if (isSuccess) {
                    let medalType = 'bronze';
                    if (crew === '고급반') medalType = 'gold';
                    else if (crew === '중급반') medalType = 'silver';

                    console.log(`      ✅ [${crew}] 완주 성공 -> 🎖️ ${medalType} 예측`);
                } else {
                    // Check if they had ANY activity in this month for this crew
                    const hasActivity = Object.keys(crewChecks).some(d => d.startsWith(`${y}-${String(m).padStart(2, '0')}`));
                    if (hasActivity) {
                        console.log(`      ❌ [${crew}] 미완주 (누락: ${missingDates.length}일)`);
                    }
                }
            }
        }
    }
    console.log("\n-------------------------------------------");
    console.log("※ 위 분석은 DB를 수정하지 않는 '읽기 전용' 시뮬레이션입니다.");
}

runAudit();
