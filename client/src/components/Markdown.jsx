import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { IconCheck, IconCopy } from './Icons.jsx';

function toText(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(toText).join('');
  if (node.props?.children) return toText(node.props.children);
  return '';
}

function CodeBlock({ className, children }) {
  const [copied, setCopied] = useState(false);
  const lang = /language-([\w+-]+)/.exec(className || '')?.[1] || '';
  const text = toText(children);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="code-block">
      <div className="code-head">
        <span className="code-lang">{lang || 'code'}</span>
        <button className="code-copy" onClick={copy}>
          {copied ? <IconCheck width={12} height={12} /> : <IconCopy width={12} height={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

export default function Markdown({ children }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children: preChildren }) {
            const first = Array.isArray(preChildren) ? preChildren[0] : preChildren;
            if (first && first.props) {
              return <CodeBlock className={first.props.className}>{first.props.children}</CodeBlock>;
            }
            return <CodeBlock>{preChildren}</CodeBlock>;
          },
          code({ className, children: codeChildren }) {
            if (className) return <code className={className}>{codeChildren}</code>;
            return <code className="inline-code">{codeChildren}</code>;
          },
          a({ href, children: linkChildren }) {
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {linkChildren}
              </a>
            );
          },
        }}
      >
        {children || ''}
      </ReactMarkdown>
    </div>
  );
}
