import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, ChevronDown, ChevronUp, Code2 } from 'lucide-react';

const LANGUAGE_LABELS = {
  javascript: 'JS',
  typescript: 'TS',
  python: 'PY',
  bash: 'SH',
  json: 'JSON',
  yaml: 'YAML',
  sql: 'SQL',
  java: 'Java',
  go: 'Go',
  plaintext: 'LOG',
};

const COLLAPSE_THRESHOLD = 30;

const LogSnippetView = ({ content, language = 'plaintext', filename }) => {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(
    content.split('\n').length > COLLAPSE_THRESHOLD
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silently
    }
  };

  const lines = content.split('\n');
  const isLong = lines.length > COLLAPSE_THRESHOLD;
  const displayContent = collapsed
    ? lines.slice(0, COLLAPSE_THRESHOLD).join('\n') + '\n…'
    : content;

  const langLabel = LANGUAGE_LABELS[language] || language.toUpperCase();

  return (
    <div className="rounded-xl border border-slate-700/60 overflow-hidden my-1 max-w-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <Code2 size={12} className="text-slate-500" />
          {filename && (
            <span className="text-xs text-slate-400 font-mono">{filename}</span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 font-mono">
            {langLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isLong && (
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 px-2 py-0.5 rounded hover:bg-slate-700 transition-all"
            >
              {collapsed ? (
                <>
                  <ChevronDown size={10} /> Expand ({lines.length} lines)
                </>
              ) : (
                <>
                  <ChevronUp size={10} /> Collapse
                </>
              )}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 px-2 py-0.5 rounded hover:bg-slate-700 transition-all"
          >
            {copied ? (
              <>
                <Check size={10} className="text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy size={10} /> Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code block */}
      <div className="text-xs overflow-x-auto">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '12px',
            background: 'transparent',
            fontSize: '0.72rem',
            lineHeight: '1.6',
          }}
          showLineNumbers
          wrapLongLines={false}
        >
          {displayContent}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default LogSnippetView;
