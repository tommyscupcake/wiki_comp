const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

const target = `    if (activePage.sharedWith) {
      activePage.sharedWith.forEach((c: any) => accessibleUserIds.add(typeof c === "string" ? c : c.userId));
    }`;

const replacement = `    if (activePage.sharedWith) {
      activePage.sharedWith.forEach((c: any) => {
        if (typeof c === 'string') {
          accessibleUserIds.add(c);
        } else if (c.userId) {
          accessibleUserIds.add(c.userId);
        } else if (c.teamId) {
          const team = teams.find((t: any) => t.id === c.teamId);
          if (team && team.members) {
            team.members.forEach((m: any) => accessibleUserIds.add(m.userId));
          }
        }
      });
    }`;

content = content.replace(target, replacement);
fs.writeFileSync('app/page.tsx', content);
console.log('Patched page.tsx');
