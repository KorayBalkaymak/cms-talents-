
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading,
  className = '',
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500/30";
  const variants = {
    primary: "bg-orange-600 text-white hover:bg-orange-700 active:bg-orange-800 border border-orange-600",
    secondary: "bg-slate-800 text-white hover:bg-slate-700 active:bg-slate-900 border border-slate-800",
    outline: "border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400",
    danger: "bg-red-600 text-white hover:bg-red-700 border border-red-600",
    ghost: "text-slate-600 hover:bg-slate-100"
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string, error?: string }> = ({ label, error, className = '', ...props }) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
    <input
      className={`w-full px-4 py-2.5 bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none block appearance-none ${error ? 'border-red-500' : 'border-slate-300'} ${className}`}
      style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
      {...props}
    />
    {error && <p className="mt-1.5 text-sm text-red-600 font-medium">{error}</p>}
  </div>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, error?: string }> = ({ label, error, children, className = '', ...props }) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
    <select
      className={`w-full px-4 py-2.5 bg-white border rounded-lg text-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all block appearance-none ${error ? 'border-red-500' : 'border-slate-300'} ${className}`}
      style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
      {...props}
    >
      {children}
    </select>
    {error && <p className="mt-1.5 text-sm text-red-600 font-medium">{error}</p>}
  </div>
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string, error?: string }> = ({ label, error, className = '', ...props }) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
    <textarea
      className={`w-full px-4 py-2.5 bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none min-h-[120px] block appearance-none ${error ? 'border-red-500' : 'border-slate-300'} ${className}`}
      style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
      {...props}
    />
    {error && <p className="mt-1.5 text-sm text-red-600 font-medium">{error}</p>}
  </div>
);

export const Badge: React.FC<{ children: React.ReactNode, variant?: 'orange' | 'dark' | 'green' | 'red' | 'yellow' | 'slate', className?: string }> = ({ children, variant = 'slate', className = '' }) => {
  const styles = {
    orange: "bg-orange-50 text-orange-700 border-orange-100",
    dark: "bg-slate-900 text-white border-slate-900",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    red: "bg-rose-50 text-rose-700 border-rose-100",
    yellow: "bg-amber-50 text-amber-700 border-amber-100"
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
};

interface AvatarProps {
  seed: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  imageUrl?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ seed, size = 'md', className = '', imageUrl }) => {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-12 h-12 text-sm', lg: 'w-20 h-20 text-xl', xl: 'w-32 h-32 text-3xl' };

  // If there's an image URL, display the image
  if (imageUrl) {
    return (
      <div className={`${sizes[size]} rounded-2xl overflow-hidden shadow-sm select-none shrink-0 bg-slate-100 ${className}`}>
        <img src={imageUrl} alt="Profile" className="w-full h-full object-cover" loading="lazy" decoding="async" />
      </div>
    );
  }

  // Otherwise show initials
  const colors = ['bg-slate-900', 'bg-orange-600', 'bg-slate-700', 'bg-orange-500', 'bg-slate-800'];
  const charCode = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorClass = colors[charCode % colors.length];
  const initials = seed.substring(0, 2).toUpperCase();

  return (
    <div className={`${sizes[size]} ${colorClass} rounded-2xl flex items-center justify-center text-white font-bold shadow-sm select-none shrink-0 ${className}`}>
      {initials}
    </div>
  );
};

export const Modal: React.FC<{ isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Schließen">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

export const Toast: React.FC<{ message: string, type: 'success' | 'error', onClose: () => void }> = ({ message, type, onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-lg shadow-lg text-white font-medium text-sm flex items-center gap-3 border ${type === 'success' ? 'bg-orange-600 border-orange-500' : 'bg-red-600 border-red-500'}`}>
      {type === 'success' ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      )}
      {message}
    </div>
  );
};

// New Components

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200 rounded ${className}`}></div>
);

export const EmptyState: React.FC<{
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, description, icon, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    {icon && <div className="mb-6 text-slate-300">{icon}</div>}
    <h3 className="text-xl font-black text-slate-900 mb-2">{title}</h3>
    {description && <p className="text-slate-500 max-w-md mb-6">{description}</p>}
    {action}
  </div>
);

interface FileUploadProps {
  label: string;
  accept: string;
  multiple?: boolean;
  onChange: (files: FileList | null) => void;
  files?: { name: string }[];
  onRemove?: (index: number) => void;
  helperText?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  accept,
  multiple = false,
  onChange,
  files = [],
  onRemove,
  helperText
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="w-full">
      <label className="block text-sm font-bold text-slate-900 mb-1.5">{label}</label>
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center cursor-pointer hover:border-orange-500 hover:bg-orange-50/50 transition-all"
      >
        <svg className="w-8 h-8 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
        </svg>
        <p className="text-sm font-bold text-slate-600">Klicken zum Hochladen</p>
        {helperText && <p className="text-xs text-slate-400 mt-1">{helperText}</p>}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => onChange(e.target.files)}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((file, idx) => (
            <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <svg className="w-4 h-4 text-orange-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
              </div>
              {onRemove && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemove(idx); }}
                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const Tabs: React.FC<{
  tabs: { id: string; label: string }[];
  activeTab: string;
  onChange: (id: string) => void;
}> = ({ tabs, activeTab, onChange }) => (
  <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
    {tabs.map(tab => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === tab.id
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
          }`}
      >
        {tab.label}
      </button>
    ))}
  </div>
);
