// src/components/code-block.tsx
import { PrismAsync as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

type CodeBlockProps = {
  code: string;
  language?: string;
};

export function CodeBlock({ code, language = 'typescript' }: CodeBlockProps) {
  return (
    <div className="my-2 rounded-md overflow-hidden">
      <SyntaxHighlighter
        language={language}
        style={atomDark}
        customStyle={{
          background: 'rgb(20 20 22)',
          margin: '0',
          fontSize: '0.875rem',
          lineHeight: '1.5',
        }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}