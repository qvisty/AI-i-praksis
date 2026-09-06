const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ignoredDirectories = new Set(['.git', 'node_modules']);
const errors = [];

/**
 * Walks a directory tree and returns files with one of the requested extensions.
 * @param {string} directory Directory to inspect.
 * @param {Set<string>} extensions File extensions to include.
 * @returns {string[]} Matching file paths.
 */
function collectFiles(directory, extensions) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
      files.push(...collectFiles(path.join(directory, entry.name), extensions));
    } else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

/**
 * Checks a local URL and optional HTML anchor from one source file.
 * @param {string} sourceFile File containing the reference.
 * @param {string} reference Relative URL or anchor.
 */
function checkReference(sourceFile, reference) {
  if (!reference || reference.startsWith('#') && sourceFile.endsWith('.md')) return;
  if (/^(https?:|mailto:|javascript:|data:)/i.test(reference)) return;

  const decoded = decodeURIComponent(reference);
  const [target, anchor] = decoded.split('#');
  const targetFile = target ? path.resolve(path.dirname(sourceFile), target) : sourceFile;

  if (!fs.existsSync(targetFile)) {
    errors.push(`${path.relative(root, sourceFile)} -> missing ${reference}`);
    return;
  }

  if (anchor && path.extname(targetFile).toLowerCase() === '.html') {
    const html = fs.readFileSync(targetFile, 'utf8');
    const anchorPattern = new RegExp(`(?:id|name)=["']${anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`);
    if (!anchorPattern.test(html)) {
      errors.push(`${path.relative(root, sourceFile)} -> missing anchor ${reference}`);
    }
  }
}

/**
 * Checks local href/src references in every HTML file in the repository.
 */
function checkHtmlReferences() {
  for (const file of collectFiles(root, new Set(['.html']))) {
    const html = fs.readFileSync(file, 'utf8');
    const references = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)].map((match) => match[1]);
    references.forEach((reference) => checkReference(file, reference));
  }
}

checkHtmlReferences();

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Local HTML links and anchors look good.');
}
