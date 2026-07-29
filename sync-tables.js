const fs = require('fs');
const path = require('path');

const targetClassNames = 'rounded-xl border border-slate-200 bg-white p-4 shadow-xs';

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Regex to match <Reveal ... className="..."> or <motion.div ... className="...">
  const regex = /<(?:Reveal|motion\.div)[^>]*className=["']([^"']+)["'][^>]*>/g;

  content = content.replace(regex, (match, classStr) => {
    // Only process if it looks like a typical card/table container
    if (!classStr.includes('bg-white') && !classStr.includes('shadow')) {
      return match;
    }

    const classes = classStr.split(/\s+/).filter(Boolean);
    const retainedClasses = [];

    for (const c of classes) {
      if (
        c.startsWith('rounded-') ||
        c.startsWith('bg-') ||
        /^p[xy]?-/.test(c) ||
        c.startsWith('shadow-') ||
        c === 'border' ||
        c.startsWith('border-') ||
        c === 'shadow'
      ) {
        // Drop these
      } else {
        retainedClasses.push(c);
      }
    }

    // Add target classes
    const newClasses = [...retainedClasses, 'rounded-xl', 'border', 'border-slate-200', 'bg-white', 'p-4', 'shadow-xs'].join(' ');
    changed = true;
    return match.replace(classStr, newClasses);
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', filePath);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      processFile(fullPath);
    }
  }
}

walkDir(path.join(__dirname, 'src/app'));
console.log('Done syncing card wrappers.');
