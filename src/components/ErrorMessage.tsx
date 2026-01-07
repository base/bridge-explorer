"use client";

import { useState } from "react";

interface ErrorMessageProps {
  title?: string;
  message: string;
  onDismiss?: () => void;
}

export const ErrorMessage = ({
  title = "Error",
  message,
  onDismiss,
}: ErrorMessageProps) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  return (
    <div
      role="alert"
      className="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 md:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-500"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">
            {title}
          </h3>
          <p className="mt-1 text-sm text-red-600/80 dark:text-red-400/80">
            {message}
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-shrink-0 rounded p-1 text-red-500 hover:bg-red-500/10 transition-colors"
            aria-label="Dismiss error"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
