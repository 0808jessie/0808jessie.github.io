import type { ReactNode } from "react";

export function RootLayout({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

export default RootLayout;
