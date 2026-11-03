import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  containerClassName?: string;
};

export function PasswordInput({
  className = "",
  containerClassName = "",
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span className={`relative block ${containerClassName}`}>
      <input {...props} type={visible ? "text" : "password"} className={className} />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-3 inline-flex items-center text-slate-400 transition hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand dark:text-slate-400 dark:hover:text-indigo-300"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  );
}
