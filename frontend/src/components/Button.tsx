import React, { type ButtonHTMLAttributes } from "react";
import { Button as UiButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "glass";
  size?: "sm" | "md" | "lg";
  shape?: "default" | "rounded" | "circle";
  fullWidth?: boolean;
  disableScale?: boolean;
}

const variantMap: Record<NonNullable<ButtonProps["variant"]>, "default" | "secondary" | "glass"> = {
  primary: "default",
  secondary: "secondary",
  glass: "glass",
};

const sizeMap: Record<NonNullable<ButtonProps["size"]>, "sm" | "default" | "lg"> = {
  sm: "sm",
  md: "default",
  lg: "lg",
};

const circleSizeClass: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 w-8 p-0",
  md: "h-10 w-10 p-0",
  lg: "h-12 w-12 p-0",
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  shape = "default",
  fullWidth = false,
  disableScale = false,
  className = "",
  style,
  ...props
}) => {
  const shapeClass =
    shape === "rounded"
      ? "rounded-full"
      : shape === "circle"
        ? cn("rounded-full", circleSizeClass[size])
        : "";

  return (
    <UiButton
      variant={variantMap[variant]}
      size={shape === "circle" ? "icon" : sizeMap[size]}
      className={cn(
        fullWidth && "w-full",
        shapeClass,
        !disableScale && "active:scale-[0.98]",
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </UiButton>
  );
};
