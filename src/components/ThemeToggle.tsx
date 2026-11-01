import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export default function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all duration-200 cursor-pointer text-xs font-semibold select-none shadow-sm ${
        isDark
          ? 'bg-slate-800/90 hover:bg-slate-700 text-amber-400 border border-slate-700 hover:border-amber-400/40'
          : 'bg-white hover:bg-slate-100 text-teal-600 border border-slate-300 hover:border-teal-400'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 hover:rotate-45 shrink-0" />
      ) : (
        <Moon className="w-4 h-4 text-teal-600 transition-transform duration-300 hover:-rotate-12 shrink-0" />
      )}
      {showLabel && (
        <span className="hidden sm:inline font-medium">
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
}
