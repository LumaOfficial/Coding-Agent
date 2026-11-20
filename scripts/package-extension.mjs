#!/usr/bin/env node
/**
 * Packages extension/ as a Chrome Web Store upload: dist/orbit-extension.zip.
 * The manifest sits at the zip root, exactly as the store expects. Uses only
 * Node built-ins so packaging never needs a network install.
 */
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'extension');
const outDir = path.join(root, 'dist');
const outFile = path.join(outDir, 'orbit-extension.zip');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function dosTime(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

async function collect(dir, base = '') {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await collect(path.join(dir, entry.name), rel)));
    else if (entry.isFile()) files.push(rel);
  }
  return files.sort();
}

async function main() {
  const manifestPath = path.join(source, 'manifest.json');
  const appPage = path.join(source, 'app', 'index.html');
  await stat(manifestPath);
  try {
    await stat(appPage);
  } catch {
    throw new Error('extension/app/index.html is missing — run `npm run build:extension` first.');
  }

  const names = await collect(source);
  const stamp = dosTime(new Date());
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const name of names) {
    const data = await readFile(path.join(source, name));
    const compressed = deflateRawSync(data, { level: 9 });
    const checksum = crc32(data);
    const nameBytes = Buffer.from(name, 'utf8');
    const header = Buffer.alloc(30);

    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(stamp.time, 10);
    header.writeUInt16LE(stamp.date, 12);
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    header.writeUInt16LE(0, 28);

    locals.push(header, nameBytes, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);

    centrals.push(central, nameBytes);
    offset += header.length + nameBytes.length + compressed.length;
  }

  const centralBuffer = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);

  await mkdir(outDir, { recursive: true });
  const zip = Buffer.concat([...locals, centralBuffer, end]);
  await writeFile(outFile, zip);
  console.log(`Packaged ${names.length} files → ${path.relative(root, outFile)} (${zip.length} bytes)`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
