import { FeedbackDialog } from "@/components/FeedbackDialog";
import { aiEnabled } from "@/lib/ai";
import { get } from "@/lib/db";
import { EggGame } from "@/components/EggGame";
import { ImageLightbox } from "@/components/ImageLightbox";
import { CommandPalette } from "@/components/CommandPalette";
import { Shortcuts } from "@/components/Shortcuts";
import { NavProgress } from "@/components/NavProgress";
import { OfflineBanner } from "@/components/OfflineBanner";
import { AppBridge } from "@/components/AppBridge";
import { Toaster } from "@/components/Toaster";
import { FullscreenBell } from "@/components/FullscreenBell";
import { RecorderBar } from "@/components/RecorderBar";
import { RecordPrompt } from "@/components/RecordPrompt";
import { Sidebar } from "@/components/Sidebar";
import { subjectHues } from "@/lib/content";
import { pragueNow } from "@/lib/dates";
import { buildSlots } from "@/lib/schedule";
import { resolveKeys } from "@/lib/shortcuts";
import { mailConfigured } from "@/lib/mail";
import { requireUser, touchActive } from "@/lib/session";
import { redirect } from "next/navigation";
import { avatarUrl, avatarVersion } from "@/lib/avatar";
import { unreadCount } from "@/lib/messages";
import { newPosts } from "@/lib/board";
import { peekTimetable } from "@/lib/sync";
import { trainingActive } from "@/lib/training";

export const metadata = { robots: { index: false, follow: false } };

const anyCash = () => !!get("SELECT 1 FROM classes WHERE cash_enabled = 1 LIMIT 1");

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  touchActive(user.id, !!user.demo);
  // nově zaregistrovaný uživatel musí nejdřív potvrdit e-mail
  if (user.email_gate && user.email_confirmed_for !== user.email && mailConfigured()) redirect("/overit-email");
  const slots = buildSlots(peekTimetable(user, "this"), pragueNow().dow, subjectHues(user.class_id));
  const keys = resolveKeys(user.shortcuts);
  const training = trainingActive(user);
  return (
    <div className="shell">
      <Sidebar me={{ name: user.name, src: (() => { const v = avatarVersion(user.id); return v ? avatarUrl(user.id, v) : null; })() }} school={user.school_name} className={user.class_name} isAdmin={user.role === "admin"} slots={slots} unread={unreadCount(user.id)} study={aiEnabled() && !user.demo} duty={!!user.duty_enabled} board={!!user.board_enabled} boardNew={newPosts(user)} cash={!!user.cash_enabled || (user.role === "admin" && anyCash())} training={training} />
      <main className="main">{children}</main>
      <AppBridge signedIn />
      <NavProgress />
      <ImageLightbox />
      <OfflineBanner />
      <Toaster />
      <RecorderBar />
      <RecordPrompt slots={slots} />
      <FullscreenBell slots={slots} />
      <EggGame />
      {!user.demo && <FeedbackDialog />}
      <Shortcuts isAdmin={user.role === "admin"} keys={keys} />
      <CommandPalette isAdmin={user.role === "admin"} keys={keys} study={aiEnabled() && !user.demo} duty={!!user.duty_enabled} board={!!user.board_enabled} cash={!!user.cash_enabled} training={training} />
    </div>
  );
}
