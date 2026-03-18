import { useState } from "react";

export const PasswordInput = ({
                                  label = "Password",
                                  placeholder = "Enter your password",
                                  value = "",
                                  onChange,
                                  error = false,
                                  requirements = [],
                              }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // 🔹 strength (простий приклад)
    const isStrong = value.length >= 8;

    return (
        <div className="w-full flex flex-col gap-2">

            {/* HEADER */}
            <div className="flex justify-between items-center">
                <label className="text-[14px] font-medium">
                    {label}
                </label>

                {value && (
                    <span className={`text-[12px] flex items-center gap-1 ${
                        error
                            ? "text-[var(--color-error)]"
                            : isStrong
                                ? "text-[var(--color-success)]"
                                : "text-[var(--color-warning)]"
                    }`}>
                        <span className="w-2 h-2 rounded-full bg-current"></span>
                        {error ? "Weak" : isStrong ? "Strong" : "Weak"}
                    </span>
                )}
            </div>

            {/* INPUT */}
            <div className="relative">
                <input
                    type={showPassword ? "text" : "password"}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    className={`
                        w-full h-[48px] px-4 pr-10 rounded-xl
                        text-[14px] font-light outline-none transition-all
                        bg-[var(--color-surface)] border

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
                    `}
                />

                {/* TOGGLE */}
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]"
                >
                    {showPassword ? "🙈" : "👁"}
                </button>
            </div>

            {/* REQUIREMENTS */}
            {requirements.length > 0 && (
                <div className="flex flex-col gap-1 mt-1">
                    {requirements.map((req, i) => {
                        const passed = req.test(value);

                        return (
                            <div
                                key={i}
                                className={`text-[12px] flex items-center gap-2 ${
                                    passed
                                        ? "text-[var(--color-success)]"
                                        : "text-[var(--color-text-secondary)]"
                                }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${
                                    passed
                                        ? "bg-[var(--color-success)]"
                                        : "bg-[var(--color-border)]"
                                }`}></span>
                                {req.label}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};