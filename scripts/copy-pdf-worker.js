// Script to copy PDF.js worker file to public directory after npm install
const fs = require("fs")
const path = require("path")

const sourceDir = path.join(__dirname, "..", "node_modules", "pdfjs-dist", "legacy", "build")
const targetDir = path.join(__dirname, "..", "public")

// Files to copy
const files = [
  { src: "pdf.worker.mjs", dest: "pdf.worker.min.mjs" },
  { src: "pdf.worker.mjs.map", dest: "pdf.worker.min.mjs.map" },
]

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
}

// Copy each file
files.forEach(({ src, dest }) => {
  const sourcePath = path.join(sourceDir, src)
  const targetPath = path.join(targetDir, dest)

  try {
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath)
      console.log(`✓ Copied ${src} to public/${dest}`)
    } else {
      console.warn(`⚠ Source file not found: ${sourcePath}`)
    }
  } catch (error) {
    console.error(`✗ Error copying ${src}:`, error.message)
  }
})

console.log("PDF.js worker files copied successfully!")
