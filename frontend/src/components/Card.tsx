import React from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  as?: React.ElementType;
  children: React.ReactNode;
  padding?: string;
  style?: React.CSSProperties;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  as,
  children,
  padding = "1.25rem",
  style,
  className,
}) => {
  const Component: React.ElementType = as ?? "div";
  return (
    <Component
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm",
        className
      )}
      style={{ padding, ...style }}
    >
      {children}
    </Component>
  );
};
