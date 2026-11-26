import { useEffect, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import { Bold, Italic, Strikethrough, Code, Heading1, Heading2, List, ListOrdered, ListChecks, Quote, SquareCode, Link2, Minus, Download, Undo2, Redo2 } from 'lucide-react';
import type { NoteItem } from '@shared/types';
import { noteToMarkdown, updateNote, wordCount, UNTITLED } from '@shared/notes';
import { act, toast } from '../store';
import { bridge, now } from '../platform';

/** A note, opened in the page area. */
export function NoteEditor({ note }: { note: NoteItem }) {
  const [title, setTitle] = useState(note.title === UNTITLED ? '' : note.title);
  const [words, setWords] = useState(() => wordCount(note.html));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: 'Start writing. Type “# ” for a heading, “- ” for a list, “[] ” for a to-do.' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: note.html,
    autofocus: false, // a new note starts in the title
    editorProps: { attributes: { class: 'note-body', 'data-testid': 'note-body', spellcheck: 'true' } },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      setWords(wordCount(html));
      // Straight into the app state; writing to disk is batched (and flushed on quit).
      act((d) => updateNote(d, note.id, { html }, now()));
    },
  });

  const exportMarkdown = async () => {
    const md = noteToMarkdown(title || UNTITLED, editor?.getHTML() ?? note.html);
    const name = `${(title || 'note').replace(/[^\w -]+/g, '').trim() || 'note'}.md`;
    if (await bridge.exportFile(name, md)) toast('Exported as Markdown');
  };
  const saved = `Saved on this computer · ${new Date(note.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;

  return (
    <div className="note" data-testid={`note-${note.id}`}>
      {editor && (
        <Toolbar editor={editor}>
          <span className="note-words" data-testid="note-words" title={saved}>
            {words} word{words === 1 ? '' : 's'}
          </span>
          <button className="icon-btn" data-testid="note-export" aria-label="Export as Markdown" title="Export as Markdown" onClick={exportMarkdown}>
            <Download size={16} />
          </button>
        </Toolbar>
      )}
      <div className="note-scroll">
        <div className="note-paper">
          <input
            className="note-title"
            placeholder={UNTITLED}
            value={title}
            data-testid="note-title"
            autoFocus={!note.html && note.title === UNTITLED}
            onChange={(e) => {
              setTitle(e.target.value);
              act((d) => updateNote(d, note.id, { title: e.target.value }, now()));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault();
                if (!editor) return;
                editor.view.dom.focus(); // move focus right now, so no keystroke lands in the title
                editor.commands.setTextSelection(1);
                editor.commands.focus('start');
              }
            }}
          />
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

/** One quiet row of tools above the text; whatever the note adds (word count, export) sits at its end. */
function Toolbar({ editor, children }: { editor: Editor; children?: React.ReactNode }) {
  const [, force] = useState(0);
  const [linking, setLinking] = useState(false);
  const [href, setHref] = useState('');
  useEffect(() => {
    const fn = () => force((x) => x + 1);
    editor.on('selectionUpdate', fn);
    editor.on('transaction', fn);
    return () => {
      editor.off('selectionUpdate', fn);
      editor.off('transaction', fn);
    };
  }, [editor]);
  const c = () => editor.chain().focus();
  const btn = (label: string, icon: React.ReactNode, on: boolean, run: () => void, testId?: string) => (
    <button
      className="icon-btn"
      aria-label={label}
      title={label}
      aria-pressed={on}
      data-testid={testId}
      // On press, not on click, so the text keeps its selection and its caret.
      onMouseDown={(e) => {
        e.preventDefault();
        run();
      }}
      // Enter or Space on the button (a click that no press came before).
      onClick={(e) => e.detail === 0 && run()}
    >
      {icon}
    </button>
  );
  return (
    <div className="note-toolbar" role="toolbar" aria-label="Formatting">
      {btn('Bold', <Bold size={16} />, editor.isActive('bold'), () => c().toggleBold().run(), 'tool-bold')}
      {btn('Italic', <Italic size={16} />, editor.isActive('italic'), () => c().toggleItalic().run(), 'tool-italic')}
      {btn('Strikethrough', <Strikethrough size={16} />, editor.isActive('strike'), () => c().toggleStrike().run())}
      {btn('Inline code', <Code size={16} />, editor.isActive('code'), () => c().toggleCode().run())}
      <span className="note-sep" />
      {btn('Heading', <Heading1 size={16} />, editor.isActive('heading', { level: 1 }), () => c().toggleHeading({ level: 1 }).run(), 'tool-h1')}
      {btn('Subheading', <Heading2 size={16} />, editor.isActive('heading', { level: 2 }), () => c().toggleHeading({ level: 2 }).run())}
      {btn('Bullet list', <List size={16} />, editor.isActive('bulletList'), () => c().toggleBulletList().run(), 'tool-bullets')}
      {btn('Numbered list', <ListOrdered size={16} />, editor.isActive('orderedList'), () => c().toggleOrderedList().run())}
      {btn('To-do list', <ListChecks size={16} />, editor.isActive('taskList'), () => c().toggleTaskList().run(), 'tool-tasks')}
      {btn('Quote', <Quote size={16} />, editor.isActive('blockquote'), () => c().toggleBlockquote().run())}
      {btn('Code block', <SquareCode size={16} />, editor.isActive('codeBlock'), () => c().toggleCodeBlock().run())}
      {btn('Divider', <Minus size={16} />, false, () => c().setHorizontalRule().run())}
      {btn(
        'Link',
        <Link2 size={16} />,
        editor.isActive('link'),
        () => {
          if (editor.isActive('link')) return c().unsetLink().run();
          setHref('');
          setLinking(true);
        },
        'tool-link',
      )}
      {linking && (
        <form
          className="note-link-form"
          onSubmit={(e) => {
            e.preventDefault();
            const v = href.trim();
            if (v) c().setLink({ href: /^[a-z]+:/i.test(v) ? v : `https://${v}` }).run();
            setLinking(false);
          }}
        >
          <input autoFocus className="input" placeholder="Paste a link and press Enter" value={href} data-testid="note-link-input" onChange={(e) => setHref(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setLinking(false)} onBlur={() => setLinking(false)} />
        </form>
      )}
      <span className="spacer" />
      {btn('Undo', <Undo2 size={16} />, false, () => c().undo().run())}
      {btn('Redo', <Redo2 size={16} />, false, () => c().redo().run())}
      {children && <span className="note-sep" />}
      {children}
    </div>
  );
}
