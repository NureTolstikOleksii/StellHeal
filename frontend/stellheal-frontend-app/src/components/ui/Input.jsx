import { useState } from "react";

export const Input = ({
                          label,
                          placeholder = "Input text",
                          value,
                          onChange,
                          helperText,
                          error = false,
                          disabled = false,
                          className = "",
                          ...props
                      }) => {
    const [isFocused, setIsFocused] = useState(false);

    const isFilled = value && value.length > 0;

    return (
        <div className="w-full flex flex-col gap-1">

            {/* LABEL */}
            {label && (
                <label className="text-[14px] font-medium text-[var(--color-text)]">
                    {label}
                </label>
            )}

            {/* INPUT */}
            <input
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                disabled={disabled}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className={`
                    w-full
                    h-[48px]
                    px-4
                    rounded-xl
                    text-[14px]
                    font-light
                    outline-none
                    transition-all

                    bg-[var(--color-surface)]
                    border

                    ${
                    error
                        ? "border-[var(--color-error)]"
                        : isFocused
                            ? "border-[var(--color-success)]"
                            : "border-[var(--color-border)]"
                }

                    ${
                    !error && !isFocused
                        ? "hover:border-[var(--color-success)]"
                        : ""
                }

                    ${
                    disabled
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-text"
                }

                    ${className}
                `}
                {...props}
            />

            {/* HELPER / ERROR TEXT */}
            {helperText && (
                <p
                    className={`
                        text-[12px]
                        ${
                        error
                            ? "text-[var(--color-error)]"
                            : "text-[var(--color-text-secondary)]"
                    }
                    `}
                >
                    {helperText}
                </p>
            )}
        </div>
    );
};