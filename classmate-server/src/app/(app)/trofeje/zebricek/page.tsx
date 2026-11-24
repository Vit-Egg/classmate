import Link from "next/link";
import { requireUser } from "@/lib/session";
import { Board } from "../Board";

export const metadata = { title: "Žebříček třídy" };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const user = await requireUser();
  return (
    <div className="wide">
      <div className="page-head">
        <div>
          <h1 className="title">Žebříček třídy</h1>
          <p className="subtitle">Kdo ve třídě nasbíral nejvíc trofejí. Známky ani absence se nepočítají.</p>
        </div>
        <div className="head-actions"><Link className="btn" href="/trofeje">← Moje trofeje</Link></div>
      </div>
      <Board user={user} />
    </div>
  );
}
