import type { Metadata } from "next";
import Link from "next/link";
import { Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Zásady ochrany osobních údajů",
  description: "Informace o zpracování osobních a zdravotních údajů dle GDPR v centru Přístav Radosti.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Shield size={22} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Zásady ochrany osobních údajů</h1>
            <p className="text-sm text-gray-500 mt-1">Platné od 1. ledna 2026 · Přístav Radosti s.r.o.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8 space-y-8 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Správce osobních údajů</h2>
            <p>
              Správcem osobních a zdravotních údajů je <strong>Přístav Radosti s.r.o.</strong> (dále jen &bdquo;centrum&rdquo;),
              neurorehabilitační centrum poskytující zdravotní a terapeutické služby.
            </p>
            <p className="mt-2">
              Kontakt na pověřence pro ochranu osobních údajů (DPO): <strong>gdpr@pristav-radosti.cz</strong>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Jaké údaje zpracováváme</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Identifikační údaje:</strong> jméno, e-mail, telefonní číslo</li>
              <li><strong>Přihlašovací údaje:</strong> hashované heslo (bcrypt), token pro 2FA</li>
              <li>
                <strong>Zdravotní údaje (zvláštní kategorie dle čl. 9 GDPR):</strong> primární diagnóza,
                anamnéza, medikace, alergie, rehabilitační záznamy, poznámky terapeutů
              </li>
              <li><strong>Kontaktní a nouzové údaje:</strong> nouzový kontakt, adresa</li>
              <li><strong>Provozní údaje:</strong> IP adresa, záznamy o přihlášení, audit log přístupů ke zdravotním datům</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Právní základ zpracování</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Zdravotní údaje:</strong> výslovný souhlas subjektu (čl. 9 odst. 2 písm. a) GDPR)
                a plnění smlouvy o poskytování zdravotní péče
              </li>
              <li>
                <strong>Identifikační a kontaktní údaje:</strong> plnění smlouvy (čl. 6 odst. 1 písm. b) GDPR)
              </li>
              <li>
                <strong>Audit logy:</strong> oprávněný zájem správce na zabezpečení systému (čl. 6 odst. 1 písm. f))
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Účel zpracování</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Vedení zdravotnické dokumentace a poskytování terapeutické péče</li>
              <li>Plánování termínů a komunikace s klientem</li>
              <li>Fakturace a evidování plateb</li>
              <li>Ochrana bezpečnosti informačních systémů</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Technická bezpečnost</h2>
            <p>Přijatá technická opatření zahrnují:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Šifrování citlivých polí:</strong> diagnóza a terapeutické poznámky jsou šifrovány algoritmem AES-256-GCM při uložení</li>
              <li><strong>Audit log:</strong> každý přístup ke zdravotním záznamům (čtení, zápis, smazání) je evidován s informací o přistupujícím uživateli, době přístupu a IP adrese</li>
              <li><strong>Dvoufaktorová autentizace (2FA):</strong> volitelná pro všechny uživatele</li>
              <li><strong>Přenos dat:</strong> výhradně přes HTTPS/TLS</li>
              <li><strong>Přístupy řízeny rolemi:</strong> zdravotní záznamy vidí pouze oprávnění pracovníci</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Doba uchovávání</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Zdravotní dokumentace: 10 let po ukončení léčby (dle zákona č. 372/2011 Sb.)</li>
              <li>Fakturační záznamy: 5 let (zákon o účetnictví)</li>
              <li>Audit logy: 2 roky</li>
              <li>Přihlašovací záznamy: 90 dní</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Vaše práva</h2>
            <p>Jako subjekt údajů máte právo:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Přístup:</strong> požádat o kopii vašich osobních dat</li>
              <li><strong>Oprava:</strong> opravit nepřesné nebo neúplné údaje</li>
              <li><strong>Výmaz (právo být zapomenut):</strong> požádat o anonymizaci/smazání dat — formulář je dostupný v klientském portálu nebo na e-mailu gdpr@pristav-radosti.cz</li>
              <li><strong>Omezení zpracování:</strong> požádat o pozastavení zpracování</li>
              <li><strong>Přenositelnost:</strong> obdržet data ve strojově čitelném formátu</li>
              <li><strong>Odvolání souhlasu:</strong> kdykoli odvolat souhlas se zpracováním zdravotních dat</li>
              <li><strong>Stížnost:</strong> podat stížnost k Úřadu pro ochranu osobních údajů (www.uoou.cz)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Předávání třetím stranám</h2>
            <p>
              Osobní data nejsou předávána třetím stranám za účelem marketingu. Data mohou být sdílena
              výhradně v rámci plnění zdravotní péče (např. spolupracující lékaři) nebo na základě zákonné povinnosti.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Cookies</h2>
            <p>
              Aplikace používá technické cookies nezbytné pro fungování přihlašování (session cookie).
              Marketingové ani analytické cookies nejsou používány.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Kontakt</h2>
            <p>
              Pro uplatnění práv nebo dotazy ohledně zpracování osobních dat nás kontaktujte na{" "}
              <a href="mailto:gdpr@pristav-radosti.cz" className="text-blue-600 hover:underline">
                gdpr@pristav-radosti.cz
              </a>
              .
            </p>
          </section>
        </div>

        <div className="text-center mt-8">
          <Link href="/login" className="text-sm text-blue-600 hover:underline">
            ← Zpět na přihlášení
          </Link>
        </div>
      </div>
    </div>
  );
}
