
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

    let totalDok = advCount;
    const dokFromInter = Math.min(interCount, basicSet.nt);
    totalDok += dokFromInter;
    let remainNt = basicSet.nt - dokFromInter;
    const dokFromBasic = Math.min(basicSet.otA, basicSet.otB, remainNt);
    totalDok += dokFromBasic;

    return totalDok;
}


async function runFullAuditV2() {
    console.log("--- 🕵️ [전체 성도] 메달/보고서(8,9번) 시뮬레이션 V2 ---");
    const baseUrl = "https://biblecrew-dev-default-rtdb.firebaseio.com";

    const year = 2026;
    const targetMonths = [1, 2];

    // 1. 전체 유저 목록 가져오기
    process.stdout.write("📥 사용자 목록 다운로드 중...");
    const usersMap = await getJSON(`${baseUrl}/users.json`) || {};
    const allUids = Object.keys(usersMap);
    console.log(` 완료 (${allUids.length}명)`);

    // Simulation Data Store
    // report8Data: { ym: [ { name, crew, status, progress, medal } ] }
    const report8Data = {};

    // report9Data: { uid: { name, totalMedals, totalDok, crews: {} } }
    const report9Data = {};

    // earnedMedalSimulStore: { uid: { 'YYYY-MM_Crew': medal } } (1독 계산용)
    const earnedMedalSimulStore = {};

    // 초기화
    allUids.forEach(uid => {
        report9Data[uid] = { name: usersMap[uid].name, totalMedals: 0, crews: {}, totalDok: 0 };
        earnedMedalSimulStore[uid] = {};
    });

    for (const m of targetMonths) {
        const ymKey = `${year}-${String(m).padStart(2, '0')}`;
        // console.log(`\n📅 ${ymKey} 분석 중...`);
        report8Data[ymKey] = [];

        // [8번 조건용] 승인 데이터 가져오기
        const approvals = await getJSON(`${baseUrl}/approvals/${ymKey}.json`) || {};

        for (const uid of allUids) {
            for (const crew of CREW_KEYS) {
                // [8번 제약]: 해당 월에 승인된 반에 한해서만 조사
                const isApproved = approvals[crew] && approvals[crew][uid];
                if (!isApproved) continue;

                // 진도 대조
                const dates = getMonthDates(year, m);
                const totalDays = dates.length;
                const crewChecks = await getJSON(`${baseUrl}/crews/${crew}/users/${uid}/checks.json`) || {};

                const checkedCount = dates.filter(d => crewChecks[d]).length;
                const progress = Math.round((checkedCount / totalDays) * 100);
                const isSuccess = checkedCount === totalDays;

                let status = isSuccess ? '성공' : (m === new Date().getMonth() + 1 ? '도전중' : '실패');
                let medalType = null;

                if (isSuccess) {
                    if (crew === '고급반') medalType = 'gold';
                    else if (crew === '중급반') medalType = 'silver';
                    else medalType = 'bronze';

                    // [9번 누적용]
                    report9Data[uid].totalMedals += 1;
                    report9Data[uid].crews[crew] = (report9Data[uid].crews[crew] || 0) + 1;

                    // [1독 계산용 저장소]
                    const awardKey = `${ymKey}_${crew}`;
                    earnedMedalSimulStore[uid][awardKey] = medalType;
                }

                // [8번 보고서 데이터 추가] (성공/실패 모두 포함)
                report8Data[ymKey].push({
                    name: usersMap[uid].name,
                    crew,
                    status,
                    progress,
                    medal: medalType
                });
            }
        }
    }

    // [1독 계산]
    allUids.forEach(uid => {
        const dokCount = calculateDokStatusSimplified(earnedMedalSimulStore[uid]);
        report9Data[uid].totalDok = dokCount;
    });


    console.log("\n===========================================");
    console.log("📊 [8번 월별 보고서 (승인된 인원 전체)]");
    console.log("===========================================");
    for (const m of targetMonths) {
        const ymKey = `${year}-${String(m).padStart(2, '0')}`;
        console.log(`\n[${ymKey} 보고서 명단]`);

        const list = report8Data[ymKey];
        if (list.length === 0) {
            console.log("- 데이터 없음 (승인된 인원이 없거나 데이터 누락)");
        } else {
            // 정렬: 반 이름 -> 이름
            list.sort((a, b) => a.crew.localeCompare(b.crew) || a.name.localeCompare(b.name));
            list.forEach(row => {
                const medalIcon = row.medal === 'gold' ? '🥇' : row.medal === 'silver' ? '🥈' : row.medal === 'bronze' ? '🥉' : '';
                const statusIcon = row.status === '성공' ? '✅' : row.status === '도전중' ? '🔥' : '❌';
                console.log(`- ${row.crew} | ${row.name} | ${statusIcon} ${row.status}(${row.progress}%) ${medalIcon}`);
            });
        }
    }

    console.log("\n===========================================");
    console.log("🏆 [9번 올해 누적 보고서 (전체 성도)]");
    console.log("===========================================");
    let hasRecord = false;
    // 메달이 있거나, 1독이 있거나, 승인 이력이 있어서 이름이 언급된 적이 있는 사람 위주로 출력
    // (완전 무기록자는 제외하여 깔끔하게 표시)
    const activeUids = allUids.filter(uid => report9Data[uid].totalMedals > 0);

    if (activeUids.length === 0) {
        console.log("- 올해 메달 획득자가 아직 없습니다.");
    } else {
        activeUids.forEach(uid => {
            const agg = report9Data[uid];
            const crewList = Object.entries(agg.crews).map(([c, count]) => `${c}(${count})`).join(', ');
            console.log(`\n👤 ${agg.name}`);
            console.log(`   - 🏅 총 메달: ${agg.totalMedals}개`);
            console.log(`   - 📖 1독 달성: ${agg.totalDok}독`);
            console.log(`   - 📋 상세 내역: ${crewList}`);
        });
    }

    console.log("\n===========================================");
    console.log("💡 [1번 메달 수] (1독 계산용 Raw Data)");
    console.log("===========================================");
    // 실제로 DB 'earnedMedals'에 들어가야 할 데이터
    for (const uid of activeUids) {
        const medals = earnedMedalSimulStore[uid];
        const keys = Object.keys(medals);
        if (keys.length > 0) {
            console.log(`- ${usersMap[uid].name}: ${keys.map(k => `${k}(${medals[k]})`).join(', ')}`);
        }
    }
}

runFullAuditV2();
