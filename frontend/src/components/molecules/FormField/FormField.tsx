import { InputHTMLAttributes } from 'react';
import { Input } from '../../atoms/Input/Input';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function FormField({ label, error, id, ...props }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <Input id={id} {...props} />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
