import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";

interface Props {
  report: string;
  className?: string;
}

export default function ReportDisplay({ report, className = "" }: Props) {
  if (!report) return null;

  // Fix escaped newlines if they appear as literal \n or \r\n in the string
  // Also fix cases where headers (#) are not preceded by a newline
  const processedReport = typeof report === 'string' 
    ? report
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/([^\n])\s*#\s/g, '$1\n\n# ') // Ensure space + # becomes newline + #
    : report;

  return (
    <div className={`prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-indigo-600 prose-table:border-collapse prose-th:border prose-th:border-slate-200 prose-th:p-2 prose-td:border prose-td:border-slate-200 prose-td:p-2 ${className}`}>
      <Markdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw]}>{processedReport}</Markdown>
    </div>
  );
}
