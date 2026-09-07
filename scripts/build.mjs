import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Keep the approved 1.63 MB source file intact. Apply only the reveal fix to
// the deployment output; assets, copy, links, and all other scripts stay intact.
const source = await readFile('index.html', 'utf8');
const css = await readFile('patches/section-reveals.css', 'utf8');
const js = await readFile('patches/section-reveals.js', 'utf8');
const marker = '// Intersection reveals are progressive enhancement: content stays readable if JS fails.';
const start = source.indexOf(marker);
const endMarker = "document.documentElement.classList.add('app-ready');";
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0 || source.indexOf(marker, start + 1) !== -1 ||
    !source.slice(start, end).includes('observer.observe(e)')) {
  throw new Error('Source changed: review the reveal patch rather than rewriting the site.');
}
let output = source.slice(0, start) + '// Section entrances are initialized independently below.\n  let observer;\n  ' + source.slice(end);
if (!output.includes('</head>') || !output.includes('</body>')) throw new Error('Incomplete HTML source.');
output = output.replace('</head>', '<style id="section-reveals-v23">\n' + css + '\n</style>\n</head>');
output = output.replace('</body>', '<script id="section-reveals-v23-script">\n' + js + '\n</script>\n</body>');
const embedded = text => [...text.matchAll(/data:image\/[^\s"'<>]+/g)].map(m => m[0]);
if (JSON.stringify(embedded(source)) !== JSON.stringify(embedded(output))) throw new Error('Embedded artwork changed.');
await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', output);
const sha256 = text => createHash('sha256').update(text).digest('hex');
const version = { version: '2.3', fix: 'mobile-section-reveals', sourceSha256: sha256(source), outputSha256: sha256(output), sourceBytes: Buffer.byteLength(source), outputBytes: Buffer.byteLength(output), artworkPreserved: true };
await writeFile('dist/site-version.json', JSON.stringify(version, null, 2) + '\n');
console.log(JSON.stringify(version));
