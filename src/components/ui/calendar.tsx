"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function Calendar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md border p-3", className)} {...props} />;
}

function CalendarDayButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn("rounded-md border px-2 py-1 text-sm", className)}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
