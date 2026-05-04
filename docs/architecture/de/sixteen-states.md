# Der 16-Zustände-Interaktionsraum von Zugriff, Eigentum, Identität und Wiederherstellung

> **Author:** Chris Zemmel · **First published:** 2026 · **License:** [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/) · **Cite:** [`CITATION.cff`](../../../CITATION.cff)

Dieses Dokument liefert eine dichte Systemanalyse aller
sechzehn möglichen Kombinationen von **Zugriff (Z)**, **Eigentum
(E)**, **Identität (I)** und **Wiederherstellung (W)**. Statt die
Zustände als triviale Einzelfälle zu betrachten, wird jeder
Zustand als Gleichgewichtszustand unter menschlichem, operativem
und ökonomischem Druck untersucht.

Zustände werden als Binärtupel `(Z, E, I, W)` geschrieben. Die
vier Achsen sind in [`four-axes.md`](./four-axes.md) definiert.

---

## (0,0,0,0): Null-Zustand

Dieser Zustand steht für die Abwesenheit jedes kryptografischen
oder sozialen Systems. Es gibt keinen Nutzer, kein Eigentum,
keine Referenz und keine Wiederherstellung. Er ist der
Vollständigkeit halber als Ursprungszustand aufgeführt, aus dem
alle anderen hervorgehen. nimimo operiert hier nicht.

## (1,0,0,0): Zugriff ohne Eigentum

Ein Nutzer kann über einen Zugriffsmechanismus eine Sitzung
eröffnen, aber es existiert kein kryptografisches Eigentum, keine
Identität und keine Wiederherstellung. Das spiegelt klassisches
Web-Onboarding wider. In nimimo ist dieser Zustand bewusst
flüchtig und wird unmittelbar von lokaler Eigentumserzeugung
abgelöst.

## (0,1,0,0): Eigentum ohne Zugriff

Kryptografische Schlüssel existieren, aber es gibt keine
Oberfläche dazu. Zwar souverän, aber für die meisten Menschen
unbrauchbar. nimimo vermeidet es, Nutzer diesem Zustand
auszusetzen, indem es Zugriff als Abstraktion ohne Autorität
hinzufügt.

## (0,0,1,0): Identität ohne Eigentum

Eine menschenlesbare Identität existiert ohne kryptografische
Rückendeckung. Das schafft semantische Autorität ohne Kontrolle,
was historisch zu Zentralisierung führt. nimimo verbietet die
Erzeugung von Identität vor dem Eigentum.

## (0,0,0,1): Wiederherstellung ohne Ziel

Wiederherstellung existiert, aber es gibt nichts
wiederherzustellen. Dieser Zustand ist logisch widersprüchlich
und wird in nimimo konstruktiv verhindert.

## (1,1,0,0): In Eigentum kollabierter Zugriff

Zugriff kontrolliert Eigentum direkt. Zugriff zu verlieren
bedeutet, Guthaben zu verlieren. Das ist das Markenzeichen
verwahrender Systeme. nimimo verhindert diesen Kollaps
strukturell.

## (1,0,1,0): In Zugriff kollabierte Identität

Identität existiert nur innerhalb eines bestimmten
Zugriffsanbieters und erzeugt damit Plattform-Lock-in. nimimo
bindet Identität stattdessen an Eigentum.

## (1,0,0,1): In Zugriff kollabierte Wiederherstellung

Wiederherstellung hängt von Zugriffsanbietern ab und führt damit
Reset-Autorität ein. nimimo-Wiederherstellungsartefakte sind
nutzerkontrolliert und unabhängig von Zugriff.

## (0,1,1,0): In Eigentum kollabierte Identität

Identität erhält Autorität über Eigentum und führt zu
kontoartiger Kontrolle. nimimo behandelt Identität ausschließlich
als Referenz.

## (0,1,0,1): In Eigentum kollabierte Wiederherstellung

Wiederherstellung kann Eigentum überschreiben und bricht damit
die kryptografische Endgültigkeit. nimimo-Wiederherstellung
erfordert den Besitz verschlüsselter Artefakte.

## (0,0,1,1): Identitäts-Reset-Systeme

Identität lässt sich ohne Eigentum wiederherstellen und schafft
damit eine zentralisierte Identitätsautorität. nimimo bindet
Identität kryptografisch an Eigentum.

## (1,1,1,0): Vollständiger Konten-Kollaps

Zugriff, Identität und Eigentum kollabieren in eine einzige
Autorität. Das ist klassische Verwahrung. nimimo lehnt diese
Architektur ab.

## (1,1,0,1): Verwaltete Wallet-Systeme

Eigentum existiert, aber Zugriff und Wiederherstellung
überschreiben es. nimimo verbietet jede Überschreibung von
Eigentum durch Wiederherstellung.

## (1,0,1,1): Systeme mit aufgeschobenem Eigentum

Identität und Zugriff existieren vor Eigentum. Wer Eigentum
später einführt, kontrolliert es. nimimo erzeugt Eigentum sofort
und lokal.

## (0,1,1,1): Souverän, aber unmenschlich

Alle Elemente existieren außer der Zugriffsabstraktion. Nutzer
führen Zugriff selbst wieder ein und kollabieren damit das
System. nimimo fügt Zugriff hinzu, ohne Autorität zu kollabieren.

## (1,1,1,1): Getrennter Vollzustand

Alle vier Achsen koexistieren, ohne zu kollabieren. Zugriff ist
austauschbar, Identität ist referenziell, Eigentum ist endgültig
und Wiederherstellung ist optional. Das ist der Zustand, den
nimimo aufrechterhält.
