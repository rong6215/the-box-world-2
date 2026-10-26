const fs = require('fs');
const path = require('path');

const boxDir = path.join(__dirname, '../../THE BOX WORLD');
const buf = fs.readFileSync(path.join(boxDir, 'System/itemInfo_true.lub'));
const text = new TextDecoder('windows-874').decode(buf);

const entryMatches = text.match(/^\t\[\d+\]\s*=\s*\{/gm);
console.log('Total item entries in itemInfo_true.lub:', entryMatches ? entryMatches.length : 0);

// Count by type
const typeRegex = /\^3F28FFประเภท:\^000000\s*([^\r\n"]+)/g;
const typeCounts = {};
let m;
while ((m = typeRegex.exec(text)) !== null) {
  const t = m[1].trim();
  typeCounts[t] = (typeCounts[t] || 0) + 1;
}
console.log('Item Type counts:', typeCounts);

// Count by position (ตำแหน่ง)
const posRegex = /\^3F28FFตำแหน่ง:\^000000\s*([^\r\n"]+)/g;
const posCounts = {};
while ((m = posRegex.exec(text)) !== null) {
  const p = m[1].trim();
  posCounts[p] = (posCounts[p] || 0) + 1;
}
console.log('Item Position counts (top 25):', Object.entries(posCounts).sort((a, b) => b[1] - a[1]).slice(0, 25));

// Count costume = true
const costumeMatches = text.match(/costume\s*=\s*true/g);
console.log('Total Costume items (costume = true):', costumeMatches ? costumeMatches.length : 0);

// Maps in mapInfo_true.lub
const mapText = fs.readFileSync(path.join(boxDir, 'System/mapInfo_true.lub'), 'utf8');
const mapMatches = mapText.match(/^\t\["[^"]+\.rsw"\]\s*=\s*\{/gm);
console.log('Total map entries in mapInfo_true.lub:', mapMatches ? mapMatches.length : 0);

// Cards in num2cardillustnametable.txt
const cardTable = fs.readFileSync(path.join(boxDir, 'data/num2cardillustnametable.txt'), 'latin1');
const cardLines = cardTable.split(/\r?\n/).filter(l => /^\d+#/.test(l.trim()));
console.log('Total card illust mappings in num2cardillustnametable.txt:', cardLines.length);
