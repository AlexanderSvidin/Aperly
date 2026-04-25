import type { ReactNode } from "react";

import { MobileAppShell } from "@/components/layout/mobile-app-shell";
import { requirePageUser } from "@/server/services/auth/current-user";

export default async function AppShellLayout({
  children
}: {
  children: ReactNode;
}) {
  const user = await requirePageUser();
  const viewerName = user.profile?.fullName ?? user.firstName;

  return <MobileAppShell viewerName={viewerName}>{children}</MobileAppShell>;
}
