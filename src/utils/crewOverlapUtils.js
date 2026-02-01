// 반별 성경 중복 체크 유틸리티 (사용자 규칙 기반)

const OT_CREWS = [
    '중급반',
    '초급반(구약A)',
    '초급반(구약B)',
    '구약파노라마'
];

const NT_CREWS = [
    '초급반',       // 신약초급반 (기존 키)
    '신약파노라마'
];

const EXCLUSIVE_CREWS = ['고급반']; // 다른 반과 절대 같이 못함

// 두 반의 겹치는 책 목록 반환 (규칙 기반이므로 가상의 이름 반환)
// UI에서 "겹치는 본문이 있어..." 메시지를 띄우기 위해 문자열 배열 리턴 형식을 유지함.
export function getOverlappingBooks(crewA, crewB) {
    if (!crewA || !crewB) return [];
    if (crewA === crewB) return ['전체(동일 반)']; // 동일 반은 100% 중복

    // 1. 고급반 체크
    if (EXCLUSIVE_CREWS.includes(crewA) || EXCLUSIVE_CREWS.includes(crewB)) {
        return ['고급반(독점 과정)'];
    }

    // 2. 구약/신약 그룹 체크
    const isA_OT = OT_CREWS.includes(crewA);
    const isA_NT = NT_CREWS.includes(crewA);

    const isB_OT = OT_CREWS.includes(crewB);
    const isB_NT = NT_CREWS.includes(crewB);

    // 둘 다 구약 그룹이면 중복
    if (isA_OT && isB_OT) return ['구약 과정 중복'];

    // 둘 다 신약 그룹이면 중복
    if (isA_NT && isB_NT) return ['신약 과정 중복'];

    return []; // 중복 없음
}

// 중복 여부 체크 (true: 중복 있음, false: 중복 없음)
export function checkContentOverlap(crewA, crewB) {
    const overlap = getOverlappingBooks(crewA, crewB);
    return overlap.length > 0;
}
