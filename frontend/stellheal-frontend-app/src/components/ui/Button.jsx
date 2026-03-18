export const Button = ({
                           children,
                           variant = "primary", // primary | secondary | tertiary
                           size = "lg",         // lg | sm
                           disabled = false,
                           className = "",
                           ...props
                       }) => {

    // 🔹 SIZE
    const sizes = {
        lg: "h-[48px] px-6 text-[14px] font-bold",
        sm: "h-[40px] px-4 text-[14px] font-medium",
    };

    // 🔹 VARIANTS
    const variants = {
        primary: `
            bg-[var(--color-primary)]
            text-white
            hover:bg-[var(--color-primary-hover)]
            active:bg-[#0F426D]
            disabled:bg-[var(--color-neutral-400)]
        `,

        secondary: `
            border border-[var(--color-primary)]
            text-[var(--color-primary)]
            bg-transparent
            hover:bg-[rgba(59,130,246,0.1)]
            active:bg-[var(--color-primary)]
            active:text-white
            disabled:border-[var(--color-neutral-200)]
            disabled:text-[var(--color-neutral-400)]
        `,

        tertiary: `
            text-[var(--color-primary)]
            bg-transparent
            hover:underline
            active:text-[var(--color-primary-hover)]
            disabled:text-[var(--color-neutral-400)]
        `,
    };

    return (
        <button
            disabled={disabled}
            className={`
                inline-flex items-center justify-center
                rounded-xl
                transition-all duration-200
                active:scale-[0.98]

                ${sizes[size]}
                ${variants[variant]}

                ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}

                ${className}
            `}
            {...props}
        >
            {children}
        </button>
    );
};