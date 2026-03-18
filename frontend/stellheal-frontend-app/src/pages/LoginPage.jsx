import { useState } from "react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { PasswordInput } from "../components/ui/PasswordInput";

export const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [errors, setErrors] = useState({});

    const validate = () => {
        const newErrors = {};

        if (!email) {
            newErrors.email = "Email is required";
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = "Invalid email";
        }

        if (!password) {
            newErrors.password = "Password is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;

        console.log("LOGIN:", { email, password });
        // тут буде API
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--color-bg)]">

            <div className="
                w-full
                max-w-md
                sm:max-w-lg
                space-y-8
            ">

                {/* LOGO + TITLE */}
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--color-primary)] text-white rounded-2xl shadow-lg">
                        <span className="text-xl font-bold">S</span>
                    </div>

                    <h1 className="text-[32px] sm:text-[40px] lg:text-[48px] leading-tight font-medium">
                        StellHeal
                    </h1>

                    <p className="text-[14px] leading-[24px] font-light text-[var(--color-text-secondary)]">
                        Твій розумний контроль медикаментів
                    </p>
                </div>

                {/* CARD */}
                <div className="
                    bg-[var(--color-surface)]
                    border border-[var(--color-border)]
                    p-6 sm:p-10
                    rounded-[2rem]
                    shadow-lg
                    space-y-6
                ">

                    <div className="text-center space-y-2">
                        <h2 className="text-[20px] sm:text-[24px] leading-[32px] font-medium">
                            Вхід у систему
                        </h2>
                        <p className="text-[14px] text-[var(--color-text-secondary)]">
                            Введіть ваші дані
                        </p>
                    </div>

                    {/* FORM */}
                    <div className="space-y-4">

                        <Input
                            label="Email"
                            placeholder="example@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            error={!!errors.email}
                            helperText={errors.email}
                        />

                        <PasswordInput
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            error={!!errors.password}
                            requirements={[]}
                        />

                        <Button onClick={handleSubmit} className="w-full">
                            Увійти
                        </Button>

                        {/* DEMO */}
                        <Button
                            variant="secondary"
                            className="w-full"
                            onClick={() => console.log("Demo")}
                        >
                            Демо-режим
                        </Button>
                    </div>
                </div>

                {/* FOOTER */}
                <p className="text-center text-[12px] text-[var(--color-text-secondary)]">
                    © 2026 StellHeal. Розроблено для дипломного проєкту.
                </p>
            </div>
        </div>
    );
};