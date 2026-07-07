const fs = require('fs');
let content = fs.readFileSync('components/WikiEditor.tsx', 'utf8');

if (!content.includes('import Mention from')) {
    content = content.replace(
        "import Placeholder from '@tiptap/extension-placeholder';",
        "import Placeholder from '@tiptap/extension-placeholder';\nimport Mention from '@tiptap/extension-mention';\nimport getSuggestion from './mentionSuggestion';"
    );
}

if (!content.includes('mentionableUsers = []')) {
    content = content.replace(
        'zoomLevel = 100,',
        'zoomLevel = 100,\n  mentionableUsers = [],'
    );
}

if (!content.includes('const mentionableUsersRef = useRef')) {
    content = content.replace(
        'const lastUpdateFromEditorRef = useRef',
        'const mentionableUsersRef = useRef(mentionableUsers);\n  useEffect(() => {\n    mentionableUsersRef.current = mentionableUsers;\n  }, [mentionableUsers]);\n\n  const lastUpdateFromEditorRef = useRef'
    );
}

if (!content.includes('Mention.configure({')) {
    content = content.replace(
        'extensions: [',
        'extensions: [\n      Mention.configure({\n        HTMLAttributes: {\n          class: "mention bg-indigo-500/20 text-indigo-400 rounded px-1 py-0.5 font-medium",\n        },\n        suggestion: getSuggestion(() => mentionableUsersRef.current),\n      }),'
    );
}

fs.writeFileSync('components/WikiEditor.tsx', content);
console.log('Patched WikiEditor.tsx');
