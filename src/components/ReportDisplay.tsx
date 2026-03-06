import React from "react";
import Markdown from "react-markdown";

interface Props {
  report: string;
}

export default function ReportDisplay({ report }: Props) {
  if (!report) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <div className="prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-indigo-600">
        <Markdown>{report}</Markdown>
      </div>
    </div>
  );
}
