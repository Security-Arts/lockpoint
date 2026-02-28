import { AuthGate } from "@/components/AuthGate";

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
