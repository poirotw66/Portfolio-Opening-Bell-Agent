import React from "react";
import Markdown from "react-markdown";

interface Props {
  report: string;
  className?: string;
}

export default function ReportDisplay({ report, className = "" }: Props) {
  if (!report) return null;

  return (
    <div className={`prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-indigo-600 ${className}`}>
      <Markdown>{report}</Markdown>
    </div>
  );
}
