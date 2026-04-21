"use client";

import ReactMarkdown from "react-markdown";

interface ArticleContentProps {
  content: string;
}

export function ArticleContent({ content }: ArticleContentProps) {
  return (
    <div className="article-body">
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h2
              className="font-['Instrument_Serif'] text-2xl text-white mt-10 mb-4 leading-snug"
              style={{ borderLeft: "3px solid #B5532C", paddingLeft: "14px" }}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-white mt-8 mb-3">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-neutral-300 leading-relaxed my-4 text-[15px]">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-4 space-y-2">{children}</ul>
          ),
          li: ({ children }) => (
            <li className="flex gap-2 text-neutral-300 text-[15px] leading-relaxed">
              <span style={{ color: "#B5532C", flexShrink: 0, marginTop: "2px" }}>—</span>
              <span>{children}</span>
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-neutral-300">{children}</em>
          ),
          code: ({ children }) => (
            <code
              className="text-[13px] px-1.5 py-0.5 rounded font-mono"
              style={{
                background: "rgba(181,83,44,0.08)",
                color: "#c8885e",
                border: "1px solid rgba(181,83,44,0.15)",
              }}
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre
              className="my-6 p-4 rounded-xl text-[13px] font-mono overflow-x-auto leading-relaxed"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#c8885e",
              }}
            >
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className="my-6 pl-4 italic text-neutral-400"
              style={{ borderLeft: "3px solid rgba(181,83,44,0.35)" }}
            >
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr
              className="my-8"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
