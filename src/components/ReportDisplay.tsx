import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  report: string;
  className?: string;
}

export default function ReportDisplay({ report, className = "" }: Props) {
  if (!report) return null;

  return (
    <div className={`prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-indigo-600 prose-table:border-collapse prose-th:border prose-th:border-slate-200 prose-th:p-2 prose-td:border prose-td:border-slate-200 prose-td:p-2 ${className}`}>
      <Markdown remarkPlugins={[remarkGfm]}>{report}</Markdown>
    </div>
  );
}
