// utils/crewConfig.js
// 5개 반(표시/저장 키) 공통 정의

/**
 * crewKey는 DB(approvals, checks, comments, nextMonthApplications 등)에 저장되는 값으로 사용됩니다.
 * 기존 데이터 호환을 위해 신약 초급반은 기존 키인 '초급반'을 유지합니다.
 */

export const CREWS = [
  { crewKey: '고급반', label: '고급반' },
  { crewKey: '중급반', label: '중급반' },
  { crewKey: '초급반(구약A)', label: '구약초급(a)' },
  { crewKey: '초급반(구약B)', label: '구약초급(b)' },
  // 기존 키 유지(신약)
  { crewKey: '초급반', label: '신약초급반' },
];

export const CREW_KEYS = CREWS.map((c) => c.crewKey);

export function getCrewLabel(crewKey) {
  const found = CREWS.find((c) => c.crewKey === crewKey);
  return found ? found.label : crewKey;
}
