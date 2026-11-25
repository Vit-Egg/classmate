"use client";

import Link from "next/link";
import { registerAction } from "@/app/actions/auth";
import { ActionForm, Submit } from "@/components/forms";

export function RegisterForm({ code, name, className, next }: { code: string; name: string; className: string; next: string }) {
  return (
    <>
      <h1 style={{ marginBottom: 6 }}>Ahoj, {name}</h1>
      <p className="subtitle" style={{ margin: "0 0 20px", fontSize: 15 }}>
        Dostal(a) jsi pozvánku do třídy {className}. Zvol si e-mail a heslo, kterými se budeš přihlašovat.
      </p>
      <ActionForm action={registerAction} resetOnSuccess={false}>
        <input type="hidden" name="code" value={code} />
        {next && <input type="hidden" name="next" value={next} />}
        <label className="field">
          <span>E-mail</span>
          <input className="input" type="email" name="email" autoComplete="email" required />
        </label>
        <label className="field">
          <span>Heslo</span>
          <input className="input" type="password" name="password" autoComplete="new-password" minLength={8} required />
        </label>
        <label className="check-row" style={{ alignItems: "flex-start" }}>
          <input type="checkbox" name="accept" value="1" required style={{ marginTop: 2 }} />
          <span>
            Souhlasím s{" "}
            <Link href="/pravidla-pouzivani" className="link-u" target="_blank">
              pravidly používání
            </Link>{" "}
            a četl(a) jsem{" "}
            <Link href="/zasady-ochrany-osobnich-udaju" className="link-u" target="_blank">
              zásady ochrany osobních údajů
            </Link>
            . Je mi aspoň 15 let, nebo s tím souhlasí můj zákonný zástupce.
          </span>
        </label>
        <div style={{ height: 4 }} />
        <Submit className="btn primary big" pendingText="Zakládám účet…">
          Vytvořit účet
        </Submit>
      </ActionForm>
      <p className="alt" style={{ marginTop: 18 }}>
        Už máš účet? <Link href="/">Přihlásit se</Link>
      </p>
    </>
  );
}
