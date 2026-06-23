import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';

const reports = [
  {
    to: '/reports/unmatched-checks',
    title: 'Unmatched Checks',
    description: 'Assign vendor names to imported checks that came through without a payee.',
    icon: FileQuestion,
  },
];

export default function Reports() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-lg font-medium mb-4">Reports</h1>
      <div className="grid sm:grid-cols-2 gap-3">
        {reports.map(r => {
          const Icon = r.icon;
          return (
            <Link
              key={r.to}
              to={r.to}
              className="block border rounded-md p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{r.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
