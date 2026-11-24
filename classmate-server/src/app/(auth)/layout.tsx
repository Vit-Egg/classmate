import Link from "next/link";
import { AppBridge } from "@/components/AppBridge";
import { ClearOfflinePages } from "@/components/PwaClient";

export const metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <ClearOfflinePages />
      <AppBridge signedIn={false} />
      <aside className="auth-hero">
        <div>
          <Link href="/" className="brand-name" aria-label="Zpět na přihlášení">Classmate</Link>
          <p className="made-by">made by <s>plojharsim</s> vitegg</p>
        </div>
        <p className="tag-line">Soukromá aplikace naší třídy: rozvrh, úkoly, testy, poznámky a pokladna na jednom místě.</p>
      </aside>
      <section className="auth-form">
        <div className="inner">{children}</div>
      </section>
    </div>
  );
}
