import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { PluginPageView } from "./PluginPageView";

export const metadata = { title: "Plugin" };

export default async function PluginPage() {
  await requireUser();
  return (
    <div className="wide">
      <Suspense fallback={null}>
        <PluginPageView />
      </Suspense>
    </div>
  );
}
