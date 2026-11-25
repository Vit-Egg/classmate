import { FeedbackDialog } from "@/components/FeedbackDialog";
import { aiEnabled } from "@/lib/ai";
import { isManager } from "@/lib/permissions";
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
import { PluginsBoot } from "@/components/PluginsBoot";
import { getPluginState } from "@/lib/plugins-store";
import { pluginPages } from "@/lib/plugins-core";
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

export const metadata = { robots: { index: false, follow: false } };

const anyCash = () => !!get("SELECT 1 FROM classes WHERE cash_enabled = 1 LIMIT 1");

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  touchActive(user.id, !!user.demo);
  // nově zaregistrovaný uživatel musí nejdřív potvrdit e-mail
  if (user.email_gate && user.email_confirmed_for !== user.email && mailConfigured()) redirect("/overit-email");
  const slots = buildSlots(peekTimetable(user, "this"), pragueNow().dow, subjectHues(user.class_id));
  const keys = resolveKeys(user.shortcuts);
  const plugins = getPluginState(user.id);
  return (
    <div className="shell">
      <PluginsBoot state={plugins} userId={user.id} />
      <Sidebar plugins={pluginPages(plugins)} me={{ name: user.name, src: (() => { const v = avatarVersion(user.id); return v ? avatarUrl(user.id, v) : null; })() }} school={user.school_name} className={user.class_name} isAdmin={isManager(user)} slots={slots} unread={unreadCount(user.id)} study={aiEnabled() && !user.demo} duty={!!user.duty_enabled} board={!!user.board_enabled} boardNew={newPosts(user)} cash={!!user.cash_enabled || (isManager(user) && anyCash())} />
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
      <Shortcuts isAdmin={isManager(user)} keys={keys} />
      <CommandPalette isAdmin={isManager(user)} keys={keys} study={aiEnabled() && !user.demo} duty={!!user.duty_enabled} board={!!user.board_enabled} cash={!!user.cash_enabled} />
    </div>
  );
}
