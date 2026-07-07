const fs = require('fs');
let content = fs.readFileSync('lib/store.ts', 'utf8');

const target = `  const saveToServer = () => {
    if (!isClient) return;
    const state = get();`;

const replacement = `  let saveTimeout: NodeJS.Timeout | null = null;
  const saveToServer = () => {
    if (!isClient) return;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      const state = get();`;

const targetEnd = `      body: JSON.stringify(payload)
    }).catch(err => console.error('Failed to sync to server database:', err));
  };`;

const replacementEnd = `      body: JSON.stringify(payload)
    }).catch(err => console.error('Failed to sync to server database:', err));
    }, 500);
  };`;

content = content.replace(target, replacement);
content = content.replace(targetEnd, replacementEnd);
fs.writeFileSync('lib/store.ts', content);
console.log('Patched store.ts');
