import React, { useMemo } from 'react';
import { getAbbreviation } from '../utils/bibleUtils';

export default function RunningCoursePath({
    todayPortion,
    todayKey,
    checks,
    toggle,
    isApproved,
    isMobile
}) {
    // 오늘 범위 - 시각적 러닝 코스 UI (공원 오솔길 스타일)
    if (!todayPortion) return null;

    const { sections } = useMemo(() => {
        const abbreviateRef = (ref) => {
            if (!ref) return "";
            return ref.replace(/장/g, '').replace(/([가-힣]{2,})/g, (m) => getAbbreviation(m));
        };

        const sumChapters = (ref) => {
            if (!ref) return 0;
            // 다양한 범위 기호(~, –, ‒, — 등)를 모두 '-'로 통일
            const normalized = ref.replace(/[~～〜∼−–—]/g, '-');
            // 쉼표로 나뉜 각 파트를 개별적으로 계산
            const parts = normalized.split(',');
            let total = 0;
            parts.forEach(p => {
                // 숫자와 대시(-)를 제외한 모든 문자를 공백으로 처리하여 매칭을 돕습니다.
                const clean = p.replace(/[^0-9-]/g, ' ');
                const rangeMatch = clean.match(/(\d+)\s*-\s*(\d+)/);
                if (rangeMatch) {
                    total += (parseInt(rangeMatch[2]) - parseInt(rangeMatch[1]) + 1);
                } else {
                    // 단일 숫자 매칭
                    const singleMatch = clean.match(/(\d+)/);
                    if (singleMatch) {
                        total += 1;
                    }
                }
            });
            return total;
        };

        // 원본 데이터를 가져옴
        let rawSections = [];
        if (todayPortion.panorama && todayPortion.panorama.parsedSections) {
            rawSections = todayPortion.panorama.parsedSections.map(s => ({
                subTitle: s.subTitle || "",
                bibleRef: s.bibleRef
            }));
        } else {
            const items = todayPortion.items || [];
            const rs = [];
            for (const it of items) {
                if (!it || !it.book || typeof it.chapter !== 'number') continue;
                const last = rs[rs.length - 1];
                if (last && last.book === it.book && it.chapter === last.to + 1) {
                    last.to = it.chapter;
                } else {
                    rs.push({ book: it.book, from: it.chapter, to: it.chapter });
                }
            }
            rawSections = rs.map(r => ({
                subTitle: "",
                bibleRef: r.from === r.to ? `${r.book} ${r.from}장` : `${r.book} ${r.from}장~${r.to}장`
            }));
        }

        // 만약 단일 섹션 안에 여러 범위가 있다면(쉼표 포함), 이를 개별 rawSections로 쪼갬
        let expandedRaw = [];
        rawSections.forEach(s => {
            if (s.bibleRef.includes(',')) {
                const parts = s.bibleRef.split(',');
                // 첫 파트에서 성경 이름을 추출 (예: "렘 29" -> "렘")
                const bookMatch = parts[0].match(/^([가-힣a-zA-Z]+)/);
                const bookName = bookMatch ? bookMatch[1] : "";

                parts.forEach((p, pIdx) => {
                    let ref = p.trim();
                    // 두 번째 파트부터 성경 이름이 없고 숫자만 있다면 앞의 성경 이름을 붙여줌
                    if (pIdx > 0 && bookName && !ref.match(/^[가-힣a-zA-Z]+/)) {
                        ref = `${bookName} ${ref}`;
                    }
                    expandedRaw.push({ subTitle: s.subTitle, bibleRef: ref });
                });
            } else {
                expandedRaw.push(s);
            }
        });

        // ✅ 섹션 통합 로직 (최대 4개 유지하며 밸런스 조정)
        let sections = [];
        if (expandedRaw.length > 0) {
            let merged = expandedRaw.map(s => ({
                ...s,
                count: sumChapters(s.bibleRef),
                abbreviations: [abbreviateRef(s.bibleRef)]
            }));

            // 4개를 넘을 경우 가장 장수가 작은 인접 섹션끼리 병합
            while (merged.length > 4) {
                let minIdx = -1;
                let minSum = Infinity;
                for (let i = 0; i < merged.length - 1; i++) {
                    const sum = merged[i].count + merged[i + 1].count;
                    if (sum < minSum) {
                        minSum = sum;
                        minIdx = i;
                    }
                }
                if (minIdx !== -1) {
                    const a = merged[minIdx];
                    const b = merged[minIdx + 1];
                    merged.splice(minIdx, 2, {
                        ...a,
                        count: a.count + b.count,
                        abbreviations: [...a.abbreviations, ...b.abbreviations],
                        subTitle: (a.subTitle && b.subTitle && a.subTitle !== b.subTitle) ? `${a.subTitle} & ${b.subTitle}` : (a.subTitle || b.subTitle)
                    });
                } else {
                    break;
                }
            }
            // 여러 장인 경우 쉼표(,)를 붙여서 구분 (마지막 줄 제외)
            // 같은 책 이름이 연속될 경우:
            // 1. 단일 장(예: "단 1", "단 3")은 한 줄로 병합 ("단 1, 3")
            // 2. 다른 책이라도 단일 장이면 쉼표로 연결 ("요이 1, 요삼 1")
            // 3. 범위(예: "창 38-39")가 포함되면 줄바꿈 ("창 38-39\n창 40-41")
            const baseSections = merged.map(s => {
                const formattedRef = s.abbreviations.reduce((acc, curr, i) => {
                    // 줄바꿈 방지 공백(NBSP) 적용: "요삼 1" -> "요삼\u00A01"
                    const safeCurr = curr.replace(/\s+/g, '\u00A0');

                    if (i === 0) return safeCurr;

                    const prev = s.abbreviations[i - 1];
                    const isPrevRange = prev.includes('-');
                    const isCurrRange = curr.includes('-'); // - (hyphen) check

                    const prevMatch = prev.match(/^([^\d]+)\s*\d+/);
                    const currMatch = curr.match(/^([^\d]+)\s*\d+/);
                    const sameBook = (prevMatch && currMatch && prevMatch[1] === currMatch[1]);

                    if (sameBook && !isPrevRange && !isCurrRange) {
                        // 단일 장끼리는 병합 (책 이름 생략, 쉼표 연결)
                        // Note: Replace might fail if we already NBSP'd. 
                        // Safe strategy: Remove book from RAW string, THEN add NBSP.
                        const rawText = curr.replace(currMatch[1], '').trim();
                        return `${acc}, ${rawText.replace(/\s+/g, '\u00A0')}`; // Numbers usually don't have space, but just in case
                    } else if (prevMatch && currMatch && prevMatch[1] === '요이' && currMatch[1] === '요삼') {
                        // 요한2서와 요한3서는 한 줄에 표시 ("요이 1, 요삼 1")
                        return `${acc}, ${safeCurr}`;
                    } else {
                        // 범위가 포함되거나 다른 책이면 줄바꿈 (책 이름 유지)
                        return `${acc}\n${safeCurr}`;
                    }
                }, "");

                return {
                    ...s,
                    bibleRef: formattedRef
                };
            });

            // ✅ 중복 설명 제거 로직: 날짜 내에서 동일한 subTitle이 반복되면 첫 번째 것만 남김
            const seenSubTitles = new Set();
            sections = baseSections.map(s => {
                if (s.subTitle && seenSubTitles.has(s.subTitle)) {
                    return { ...s, subTitle: "" };
                }
                if (s.subTitle) seenSubTitles.add(s.subTitle);
                return s;
            });
        }

        return { sections };
    }, [todayPortion]);

    // 지그재그 패턴 생성 (2번 코스 우측 확대, 3번 코스 좌측 확대)
    const getPos = (idx) => {
        const xOffsets = [-50, 30, -55, 35]; // 지그재그 편차를 줄여 아이콘 겹침 방지
        return xOffsets[idx % 4];
    };

    const roadHeight = 50; // 코스 상하 간격 축소 (65 -> 50)

    return (
        <div style={{
            marginTop: 18,
            width: '100%',
            position: 'relative',
            padding: '10px 0',
            overflow: 'hidden' // 장식물이 삐져나가지 않게
        }}>
            <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                {/* 1권일 때 위쪽 도로 추가 (달리는 느낌) */}
                {sections.length === 1 && (
                    <div style={{ width: '100%', height: 40, position: 'relative', marginBottom: 5 }}>
                        <svg style={{ position: 'absolute', top: 0, left: '50%', width: 200, height: 40, transform: 'translateX(-50%)' }}>
                            <path d={`M 100 0 Q 100 20, ${100 + getPos(0)} 40`} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="9" strokeLinecap="round" />
                            <path d={`M 100 0 Q 100 20, ${100 + getPos(0)} 40`} fill="none" stroke="rgba(3,71,50,0.2)" strokeWidth="2.5" strokeDasharray="6,6" />
                        </svg>
                    </div>
                )}

                {sections.map((sec, idx) => {
                    const x = getPos(idx);
                    const isLast = idx === sections.length - 1;

                    return (
                        <div key={idx} style={{
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            position: 'relative',
                            marginBottom: isLast ? (sections.length === 1 ? 50 : 0) : roadHeight
                        }}>
                            {/* 랜드마크 장식 (기존 퍼센트 기반 배치로 원복) */}
                            {idx === 0 && (
                                <div style={{ position: 'absolute', left: '1.2%', top: 18, display: 'flex', alignItems: 'flex-end', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))', zIndex: 3 }}>
                                    <span style={{ fontSize: 42, marginRight: -10 }}>🌳</span>
                                    <span style={{ fontSize: 28 }}>🌲</span>
                                </div>
                            )}
                            {idx === 1 && <img src="/runner_v2.png" alt="runner" style={{ position: 'absolute', right: '8%', top: 5, width: 45, height: 'auto', zIndex: 3 }} />}
                            {idx === 2 && <img src="/sign_v2.png" alt="sign" style={{ position: 'absolute', left: '1%', top: -50, width: 65, height: 'auto', zIndex: 3 }} />}
                            {idx >= 4 && (idx % 2 === 0
                                ? <span style={{ position: 'absolute', right: '1.2%', top: -5, fontSize: 36, opacity: 1, zIndex: 3 }}>🌳</span>
                                : <span style={{ position: 'absolute', left: '1.2%', top: -5, fontSize: 36, opacity: 1, zIndex: 3 }}>🌷</span>
                            )}

                            {/* 체크포인트 노드 */}
                            <div style={{
                                transform: `translateX(${x}px)`,
                                transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                zIndex: 2
                            }}>
                                {/* 장수 표시 (원 크기 미세 축소) */}
                                <div style={{
                                    minWidth: 48, height: 48, padding: '0 8px',
                                    borderRadius: 24,
                                    background: checks[todayKey] ? '#E5F3E6' : '#034732',
                                    border: checks[todayKey] ? '4px solid #064E3B' : '4px solid #F3F4F6',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 19, fontWeight: 900,
                                    color: checks[todayKey] ? '#064E3B' : '#ffffff',
                                    boxShadow: 'none'
                                }}>{sec.count}</div>

                                {/* 성경 목록 (인덱스에 따라 좌/우 배치) */}
                                <div style={{
                                    position: 'absolute',
                                    ...([1, 3].includes(idx) ? { right: 52 } : { left: 52 }), // 2번(idx 1)과 4번(idx 3)은 왼쪽 배치
                                    width: 190, // 확보된 공간 활용
                                    textAlign: [1, 3].includes(idx) ? 'right' : 'left',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}>
                                    {/* {sec.subTitle && (
                                        <div style={{
                                            fontSize: 11, fontWeight: 900,
                                            letterSpacing: '-0.05em', // 글자 간격 좁힘
                                            color: checks[todayKey] ? '#FFEB3B' : '#1565C0', // 체크됨: 노랑, 체크안됨: 파랑
                                            opacity: 1, textShadow: checks[todayKey] ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                                            marginBottom: 2,
                                            lineHeight: 1.2,
                                            wordBreak: 'keep-all'
                                        }}>
                                            {sec.subTitle.includes(':') ? sec.subTitle.split(':')[1].trim() : sec.subTitle}
                                        </div>
                                    )} */}
                                    <div style={{
                                        fontSize: 19, fontWeight: 900,
                                        color: checks[todayKey] ? '#E5F3E6' : '#034732',
                                        textShadow: checks[todayKey] ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'keep-all',
                                        lineHeight: 1.2
                                    }}>
                                        {sec.bibleRef}
                                    </div>
                                </div>
                            </div>

                            {/* 커넥터 */}
                            {!isLast && (
                                <svg
                                    style={{
                                        position: 'absolute',
                                        top: 40, // 원 내부에서 커넥터 시작 (끊김 방지)
                                        left: '50%',
                                        width: 260,
                                        height: roadHeight + 8, // 다음 원 내부까지 연결
                                        transform: 'translateX(-50%)',
                                        zIndex: 1,
                                        pointerEvents: 'none'
                                    }}
                                >
                                    <path
                                        d={`M ${130 + x} 0 Q ${130 + (x + getPos(idx + 1)) / 2 + (idx % 2 === 0 ? 45 : -45)} ${roadHeight / 2}, ${130 + getPos(idx + 1)} ${roadHeight}`}
                                        fill="none"
                                        stroke={checks[todayKey] ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.8)'}
                                        strokeWidth="10"
                                        strokeLinecap="round"
                                    />
                                    <path
                                        d={`M ${130 + x} 0 Q ${130 + (x + getPos(idx + 1)) / 2 + (idx % 2 === 0 ? 45 : -45)} ${roadHeight / 2}, ${130 + getPos(idx + 1)} ${roadHeight}`}
                                        fill="none"
                                        stroke={checks[todayKey] ? 'rgba(255,255,255,0.75)' : 'rgba(3,71,50,0.3)'}
                                        strokeWidth="2.5"
                                        strokeDasharray="6,8"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            )}

                            {/* 1권일 때 아래쪽 도로 추가 (달리는 과정) */}
                            {isLast && sections.length === 1 && (
                                <svg style={{ position: 'absolute', top: 40, left: '50%', width: 200, height: 60, transform: 'translateX(-50%)', zIndex: 1 }}>
                                    <path d={`M ${100 + getPos(0)} 0 Q ${100 + getPos(0)} 30, 100 60`} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="9" strokeLinecap="round" />
                                    <path d={`M ${100 + getPos(0)} 0 Q ${100 + getPos(0)} 30, 100 60`} fill="none" stroke="rgba(3,71,50,0.2)" strokeWidth="2.5" strokeDasharray="6,6" />
                                </svg>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
