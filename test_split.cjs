const getAbbreviation = (b) => b.substring(0, 1); // Mock
const abbreviateRef = (ref) => ref; // Mock

const sumChapters = (ref) => {
    if (!ref) return 0;
    const normalized = ref.replace(/[~～〜∼−–—]/g, '-');
    const parts = normalized.split(',');
    let total = 0;
    parts.forEach(p => {
        const clean = p.replace(/[^0-9-]/g, ' ');
        const rangeMatch = clean.match(/(\d+)\s*-\s*(\d+)/);
        if (rangeMatch) {
            total += (parseInt(rangeMatch[2]) - parseInt(rangeMatch[1]) + 1);
        } else {
            const singleMatch = clean.match(/(\d+)/);
            if (singleMatch) {
                total += 1;
            }
        }
    });
    return total;
};

const splitSection = (s) => {
    const simplified = s.bibleRef.replace(/장/g, '').replace(/[~～〜∼−–—]/g, '-');
    const match = simplified.match(/^([가-힣\s\u00A0a-zA-Z]+)\s*(\d+)(?:\s*-\s*(\d+))?/);

    if (match) {
        const book = match[1].trim();
        const start = parseInt(match[2]);
        const end = match[3] ? parseInt(match[3]) : start;
        const total = end - start + 1;

        if (total >= 2) {
            const half = Math.floor(total / 2);
            const mid = start + half - 1;
            const part1Ref = start === mid ? `${book} ${start}장` : `${book} ${start}장~${mid}장`;
            const part2Ref = (mid + 1) === end ? `${book} ${end}장` : `${book} ${mid + 1}장~${end}장`;
            return [
                { ...s, bibleRef: part1Ref, count: mid - start + 1, abbreviations: [abbreviateRef(part1Ref)], subTitle: s.subTitle },
                { ...s, bibleRef: part2Ref, count: end - (mid + 1) + 1, abbreviations: [abbreviateRef(part2Ref)], subTitle: "" }
            ];
        }
    }
    return [s];
};

let merged = [{ subTitle: "", bibleRef: "말라기 1장~4장", count: 4, abbreviations: ["말 1~4"] }];

console.log("Initial:", merged.length);

for (let retry = 0; retry < 5 && merged.length < 3; retry++) {
    let maxIdx = -1;
    let maxCount = -1;
    for (let i = 0; i < merged.length; i++) {
        if (merged[i].count > maxCount) {
            maxCount = merged[i].count;
            maxIdx = i;
        }
    }
    if (maxIdx !== -1 && merged[maxIdx].count >= 2) {
        const splitResult = splitSection(merged[maxIdx]);
        if (splitResult.length > 1) {
            merged.splice(maxIdx, 1, ...splitResult);
        } else break;
    } else break;
}

console.log("Final length:", merged.length);
merged.forEach(m => console.log(m.bibleRef));
