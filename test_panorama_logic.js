
import { getDailyBiblePortionByCrew } from './src/utils/bibleUtils.js';

// Mock date lists
const feb28 = Array.from({ length: 28 }, (_, i) => `2026-02-${String(i + 1).padStart(2, '0')}`);
const jan31 = Array.from({ length: 31 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`);

// Function to print summary
function check(crew, dateList) {
    const plan = getDailyBiblePortionByCrew(crew, dateList);
    console.log(`\n[${crew} - ${dateList.length} days]`);
    plan.forEach((p, i) => {
        // Print Day 5, 26, 31 specifically to check merges
        // 28일 테스트:
        // Day 5 (idx 4): should be merged Day 5+6
        // Day 26 (idx 25): should be merged Day 26+27
        if ([4, 5, 25, 26, 27, 30].includes(i)) {
            console.log(`D${i + 1}: ${p.label} (${p.chapters}ch)`);
        }
    });
    console.log(`Total Items: ${plan.length}`);
}

check('구약파노라마', feb28);
check('구약파노라마', jan31);
