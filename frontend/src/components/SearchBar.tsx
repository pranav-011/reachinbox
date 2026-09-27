import React from 'react';
import { Search, X, Sparkles } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  isElasticsearch: boolean;
  isSearching: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  isElasticsearch,
  isSearching,
}) => {
  return (
    <div className="relative flex items-center w-full max-w-md">
      <Search className="absolute left-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search emails by recipient, subject, or content..."
        className="w-full pl-10 pr-24 py-2 text-xs bg-white dark:bg-[#161922] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-all shadow-sm"
      />
      <div className="absolute right-3 flex items-center gap-1.5">
        {value && (
          <button
            onClick={() => onChange('')}
            className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 ${
            isElasticsearch
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
          }`}
          title={isElasticsearch ? 'Indexed via Elasticsearch' : 'Database Search'}
        >
          <Sparkles className="h-2.5 w-2.5" />
          {isElasticsearch ? 'Elastic' : 'DB'}
        </span>
      </div>
    </div>
  );
};
