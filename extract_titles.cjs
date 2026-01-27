const fs = require('fs');
const path = require('path');

const biblePath = path.join(__dirname, 'public', 'bible_kor.json');
const outputPath = path.join(__dirname, 'src', 'utils', 'bibleTitles.js');

try {
    const data = JSON.parse(fs.readFileSync(biblePath, 'utf8'));
    const titles = {};

    for (const book in data) {
        titles[book] = {};
        for (const chapter in data[book]) {
            const verses = data[book][chapter];
            let firstTitle = null;

            // Sort verses just in case
            const verseNumbers = Object.keys(verses).sort((a, b) => parseInt(a) - parseInt(b));

            for (const vno of verseNumbers) {
                const text = verses[vno];
                const match = text.match(/^<([^>]+)>/);
                if (match) {
                    firstTitle = match[1].trim();
                    break; // Take the first one in the chapter
                }
            }

            if (firstTitle) {
                titles[book][chapter] = firstTitle;
            }
        }
    }

    const content = `// Automatically generated Bible Chapter Titles\nexport const BIBLE_TITLES = ${JSON.stringify(titles, null, 2)};\n`;
    fs.writeFileSync(outputPath, content);
    console.log('Successfully extracted titles to src/utils/bibleTitles.js');
} catch (error) {
    console.error('Error processing bible titles:', error);
    process.exit(1);
}
