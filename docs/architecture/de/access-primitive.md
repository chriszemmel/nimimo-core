# Zugriff ohne Autorität: Sitzungsbasierte Interaktion in souveränen kryptografischen Systemen

> **Author:** Chris Zemmel · **First published:** 2026 · **License:** [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/) · **Cite:** [`CITATION.cff`](../../../CITATION.cff)

## Abstract

Dieses Paper formalisiert den Begriff des nicht-autorisierenden
Zugriffs in nicht-verwahrenden kryptografischen Systemen. Zugriff
ermöglicht Sitzungskontinuität, Geräteportabilität und
Benutzbarkeit, ohne Autorität über Identität, Eigentum oder
Vermögenswerte zu gewähren. Durch die Trennung von Zugriff und
Autorität können Systeme für Nicht-Expertinnen und -Experten
skalieren, ohne verwahrende Kontrolle oder verborgene
Vertrauensannahmen einzuführen.

---

## 1. Problemstellung

Kryptografische Systeme legen Nutzerinnen und Nutzern traditionell
die Eigentumsprimitive unmittelbar offen. Das sichert zwar
Souveränität, schafft aber erhebliche Benutzbarkeitshürden.
Versuche, die Reibung zu verringern, kollabieren häufig Zugriff
und Autorität, führen zu verwahrendem Verhalten und zu impliziten
Vertrauensmodellen, die die Dezentralisierung aushöhlen.

## 2. Designziele

- Sitzungskontinuität über Geräte und Umgebungen hinweg ermöglichen.
- Nutzer wiedererkennen, ohne Schlüssel offenzulegen.
- Wiederherstellungsabläufe unterstützen, ohne Autorität zu
  eskalieren.
- Strenge nicht-verwahrende Garantien bewahren.
- Zugriff austauschbar, widerrufbar und flüchtig halten.

## 3. Definition von Zugriff

Zugriff ist definiert als die Fähigkeit, mit Systemoberflächen zu
interagieren und Aktionen anzustoßen. Er ist ausdrücklich
nicht-autorisierend und kann keine kryptografischen Entscheidungen
treffen.

**Zugriff darf:**
- Eine Sitzung authentifizieren.
- Identitäts- und Guthabeninformationen anzeigen.
- Eigentumsaktionen anfragen.

**Zugriff darf nicht:**
- Transaktionen signieren.
- Eigentumsbindungen verändern.
- Identität neu zuweisen.
- Vermögenswerte eigenständig wiederherstellen.

## 4. Zugriff als sitzungsgebundene primitive Einheit

Zugriff wird als sitzungsgebundene primitive Einheit modelliert.
Sitzungen sind zeitlich begrenzt, an ein Gerät gebunden und
widerrufbar. Sie existieren allein zur Verbesserung der
Benutzbarkeit und tragen keine langfristige Autorität.

## 5. Authentifizierung ohne Autorität

Authentifizierungsmechanismen wie E-Mail-Login, Passkeys oder
OAuth etablieren Sitzungen, verleihen aber keine Eigentums- oder
Identitätskontrolle. Authentifizierung beweist Anwesenheit, nicht
Autorität.

## 6. Interaktion von Zugriff und Identität

Zugriff interagiert mit Identität ausschließlich lesend. Er darf
Namen auflösen, Identitätsmetadaten anzeigen und
Routing-Informationen darstellen, aber er darf
Identitätsbindungen weder erzeugen, zerstören noch verändern.

## 7. Interaktion von Zugriff und Eigentum

Zugriff darf Eigentumsaktionen anfragen, aber nicht ausführen.
Für alle Aktionen, die Wertrouting, Resolver-Zustand oder
Asset-Kontrolle verändern, ist eine Eigentumsfreigabe
erforderlich.

## 8. Ausfallmodi kollabierten Zugriffs

Systeme, die Zugriff und Autorität kollabieren, zeigen typische
Ausfallmodi: Kontoübernahme, erzwungene Wiederherstellung und
stille verwahrende Eingriffe. Diese Ausfälle entstehen dadurch,
dass Zugriff autorisierenden Zustand verändern darf.

## 9. Wiederherstellung ist kein Zugriff

Wiederherstellungsmechanismen werden häufig als erweiterter
Zugriff implementiert. Das ist falsch. Wiederherstellung muss
Eigentum rekonstituieren, ohne kryptografische Garantien zu
umgehen oder einseitige Autorität zu gewähren.

## 10. Vergleich mit existierenden Modellen

| System                 | Zugriffsmodell   | Autoritätsgrenze  | Ergebnis                |
| ---------------------- | ---------------- | ----------------- | ----------------------- |
| Wallets                | Implizit         | Kollabiert        | Hohe Benutzbarkeitsreibung |
| Verwahrplattformen     | Kontenbasiert    | Zentralisiert     | Verwahrungsrisiko       |
| Social Wallets         | Vermischt        | Eskalierend       | Verborgene Verwahrung   |
| Dieses Modell          | Sitzungsbasiert  | Explizit          | Souveräne Benutzbarkeit |

## 11. Sicherheitsinvarianten

- Das Ablaufen von Zugriff beeinflusst Eigentum nicht.
- Eine Zugriffskompromittierung bedeutet keinen Vermögensverlust.
- Der Widerruf von Zugriff zerstört Identität nicht.
- Der Austausch von Zugriff überträgt keine Autorität.

## 12. Fazit

Die Trennung von Zugriff und Autorität ist wesentlich für den Bau
benutzbarer und zugleich souveräner kryptografischer Systeme.
Durch die Formalisierung von Zugriff als nicht-autorisierende
sitzungsgebundene primitive Einheit können Systeme zu einer
breiten Nutzerbasis skalieren, ohne Dezentralisierung zu opfern
oder verwahrendes Risiko einzuführen.
