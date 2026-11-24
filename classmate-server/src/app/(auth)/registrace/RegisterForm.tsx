"use client";

import Link from "next/link";
import { useState } from "react";
import { registerAction } from "@/app/actions/auth";
import { ActionForm, Submit } from "@/components/forms";

type School = { id: number; name: string };

export function RegisterForm({ schools, next, demo = false }: { schools: School[]; next: string; demo?: boolean }) {
  const [schoolId, setSchoolId] = useState(schools[0]?.id);
  return (
    <>
      <h1 style={{ marginBottom: 6 }}>Vytvoř si účet</h1>
      <p className="subtitle" style={{ margin: "0 0 20px", fontSize: 15 }}>
        Vyber školu a propoj se s Bakaláři. Jméno i třídu vezmeme z Bakalářů, nemusíš je vybírat ani psát. Přijmout tě musí tvoje třída: škola ji musí mít povolenou.
      </p>
      <ActionForm action={registerAction} resetOnSuccess={false}>
        {next && <input type="hidden" name="next" value={next} />}
        <label className="field">
          <span>E-mail</span>
          <input className="input" type="email" name="email" autoComplete="email" required />
        </label>
        <label className="field">
          <span>Heslo</span>
          <input className="input" type="password" name="password" autoComplete="new-password" minLength={8} required />
        </label>
        <label className="field">
          <span>Škola</span>
          <select className="select" name="school" value={schoolId} onChange={(e) => setSchoolId(Number(e.target.value))}>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="fieldset">
          <legend>Bakaláři (povinné)</legend>
          <div className="form" style={{ marginTop: 10 }}>
            <label className="field">
              <span>Jméno do Bakalářů</span>
              <input className="input" name="bkUser" autoComplete="off" required />
            </label>
            <label className="field">
              <span>Heslo do Bakalářů</span>
              <input className="input" type="password" name="bkPass" autoComplete="off" required />
            </label>
            <p className="hint" style={{ marginTop: 0 }}>
              Rozvrh se bere z Bakalářů a nejde v aplikaci upravit. Heslo se neukládá, jen se jednorázově ověří.
            </p>
          </div>
        </fieldset>
        <label className="check-row" style={{ alignItems: "flex-start" }}>
          <input type="checkbox" name="accept" value="1" required style={{ marginTop: 2 }} />
          <span>
            Je mi aspoň 13 let a souhlasím s{" "}
            <Link href="/pravidla-pouzivani" className="link-u" target="_blank">
              pravidly používání
            </Link>
            .
          </span>
        </label>
        <div style={{ height: 4 }} />
        <Submit className="btn primary big" pendingText="Ověřuji v Bakalářích…">
          Vytvořit účet
        </Submit>
      </ActionForm>
      <p className="hint" style={{ marginTop: 18 }}>
        Co aplikace ukládá a komu se údaje předávají, je v{" "}
        <Link href="/zasady-ochrany-osobnich-udaju" className="link-u">
          zásadách ochrany osobních údajů
        </Link>
        .
      </p>
      <p className="alt" style={{ marginTop: 12 }}>
        Už máš účet? <Link href={next ? `/prihlaseni?next=${encodeURIComponent(next)}` : "/prihlaseni"}>Přihlásit se</Link>
      </p>
      {demo && (
        <p className="alt" style={{ marginTop: 6 }}>
          Chceš to nejdřív vyzkoušet? <Link href="/demo">Spustit demo bez registrace</Link>
        </p>
      )}
    </>
  );
}
