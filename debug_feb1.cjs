const { getDailyBiblePortionByCrew } from './src/utils/bibleUtils';

const dateList = [];
for (let i = 1; i <= 28; i++) {
    dateList.push(`2026-02-${String(i).padStart(2, '0')}`);
}

const crews = ['초급반', '중급반', '고급반', '구약파노라마', '신약파노라마'];
crews.forEach(crew => {
    const portions = getDailyBiblePortionByCrew(crew, dateList);
    const feb1 = portions.find(p => p.date === '2026-02-01');
    console.log(`Crew: ${crew}, Date: 2026-02-01`);
    console.log(`Label: ${feb1.label}`);
    console.log(`Items count: ${feb1.items.length}`);
    // console.log(`Items: ${JSON.stringify(feb1.items)}`);
    console.log('---');
});
