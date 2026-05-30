#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const nextDir = path.join(root, '.next')

const excludedPrefixes = [
  '.git/',
  '.next/cache/',
  'uploads/',
  'public/uploads/',
  'upd/',
]

function toPosix(value) {
  return value.split(path.sep).join('/')
}

function shouldExclude(relativePath) {
  return (
    excludedPrefixes.some((prefix) => relativePath.startsWith(prefix))
    || relativePath.startsWith('.env')
    || relativePath.endsWith('.zip')
  )
}

function walk(dir, results = []) {
  if (!fs.existsSync(dir)) return results

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, results)
    } else if (entry.isFile() && entry.name.endsWith('.nft.json')) {
      results.push(fullPath)
    }
  }

  return results
}

let changedFiles = 0
let removedEntries = 0
let removedBytes = 0

for (const traceFile of walk(nextDir)) {
  const traceDir = path.dirname(traceFile)
  const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'))
  const files = Array.isArray(trace.files) ? trace.files : []

  const kept = files.filter((file) => {
    const absolutePath = path.resolve(traceDir, file)
    const relativePath = toPosix(path.relative(root, absolutePath))

    if (!shouldExclude(relativePath)) {
      return true
    }

    removedEntries += 1
    if (fs.existsSync(absolutePath)) {
      removedBytes += fs.statSync(absolutePath).size
    }
    return false
  })

  if (kept.length !== files.length) {
    changedFiles += 1
    fs.writeFileSync(
      traceFile,
      JSON.stringify({ ...trace, files: kept }),
    )
  }
}

console.log(
  `Pruned Next traces: ${removedEntries} entries from ${changedFiles} files`
  + ` (${(removedBytes / 1024 / 1024).toFixed(1)} MB)`,
)
