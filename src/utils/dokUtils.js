/**
 * 성경 1독 계산 유틸리티
 * 
 * [조합 규칙]
 * 1순위: 고급반 1개 -> 1독
 * 2순위: 중급반 1개 + 신약초급 1개 -> 1독
 * 3순위: 초급반(구약A) 1개 + 초급반(구약B) 1개 + 신약초급 1개 -> 1독
 * 
 * [입력]
 * earnedMedals: { "2025-01_고급반": "gold", "2025-02_중급반": "silver", ... }
 */

export function calculateDokStatus(earnedMedals = {}) {
    // 1. 수료한 반 목록 추출 및 카운팅
    const inventory = {
        고급반: 0,
        중급반: 0,
        '초급반(구약A)': 0,
        '초급반(구약B)': 0,
        '초급반': 0 // 신약초급
    };

    Object.keys(earnedMedals).forEach(key => {
        // key 형식: "YYYY-MM_반이름"
        const parts = key.split('_');
        if (parts.length < 2) return;

        const crewName = parts[1];
        if (inventory.hasOwnProperty(crewName)) {
            inventory[crewName]++;
        }
    });

    let totalDok = 0;
    let remaining = { ...inventory };

    // 2. 1순위: 고급반 소모
    while (remaining['고급반'] > 0) {
        totalDok++;
        remaining['고급반']--;
    }

    // 3. 2순위: 중급반 + 신약초급 소모
    while (remaining['중급반'] > 0 && remaining['초급반'] > 0) {
        totalDok++;
        remaining['중급반']--;
        remaining['초급반']--;
    }

    // 4. 3순위: 구약A + 구약B + 신약초급 소모
    while (remaining['초급반(구약A)'] > 0 && remaining['초급반(구약B)'] > 0 && remaining['초급반'] > 0) {
        totalDok++;
        remaining['초급반(구약A)']--;
        remaining['초급반(구약B)']--;
        remaining['초급반']--;
    }

    // 소모되지 않고 남은 조각들 필터링
    const fragments = Object.entries(remaining)
        .filter(([_, count]) => count > 0)
        .map(([name, count]) => ({ name, count }));

    return {
        totalDok,
        fragments,
        remaining // 상세 조각 정보 (매핑용)
    };
}
