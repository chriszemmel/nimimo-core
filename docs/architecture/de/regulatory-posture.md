# Regulatorische Haltung

> **Author:** Chris Zemmel · **First published:** 2026 · **License:** [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/) · **Cite:** [`CITATION.cff`](../../../CITATION.cff)

*Dieses Dokument beschreibt die strukturelle Designabsicht von
nimimo und stellt keine Rechtsberatung dar. Die folgenden
Aussagen sind Eigenschaften der Architektur, keine Meinungen
darüber, wie ein bestimmtes Gesetz in einer bestimmten
Jurisdiktion Anwendung findet. Wer rechtliche Beratung sucht,
sollte qualifizierten Rat in der eigenen Jurisdiktion einholen.*

---

## Ausgangspunkt

Die meisten regulatorischen Kategorien, die auf Krypto-Produkte
angewendet werden, knüpfen an eine bestimmte operative Tätigkeit
an: Kundenvermögen halten, Werte im Auftrag von Nutzern
übertragen, Trades matchen, Wertpapiere emittieren oder Konten
betreiben. Die in [`four-axes.md`](./four-axes.md) definierte
Vier-Achsen-Trennung macht genau diese Tätigkeiten strukturell
abwesend in nimimo. Das ist keine Compliance-Haltung; es ist eine
architektonische Eigenschaft.

Die Zugriffsachse trägt keine Autorität. Die Eigentumsachse ist
kryptografisch und existiert ausschließlich auf dem Gerät des
Nutzers. Die Identitätsachse ist rein referenziell und signiert
niemals. Die Wiederherstellungsachse ist nutzerkontrolliert,
verschlüsselt und wird vom Server nie berührt. Es gibt keinen
Punkt im System, an dem nimimo etwas hält, kontrolliert, bewegt,
matched, emittiert oder investiert.

Der Rest dieses Dokuments geht bestimmte regulatorische
Kategorien durch und erklärt für jede den strukturellen Grund,
warum nimimo die regulierte Tätigkeit nicht ausführt. Es geht
nicht darum, „konform zu sein"; es geht darum, die Tätigkeit
überhaupt nicht durchzuführen.

---

## Money Transmitter (US-Bundesstaatsebene)

Ein Money Transmitter nimmt Gelder von einer Partei entgegen und
übermittelt sie an eine andere. nimimo nimmt niemals Gelder
entgegen. Keine Transaktion im System läuft über einen von nimimo
kontrollierten Schlüssel, ein Konto oder eine Adresse. Wenn ein
Sender an ein nimimo-Handle zahlt, signiert die Wallet des
Senders eine direkte On-Chain-Transaktion an eine öffentliche
Adresse, die aus dem Eigentumsmaterial des Empfängers abgeleitet
ist. nimimo ist der Resolver, nicht der Überträger.

Die Eigentumsachse ist kryptografisch von Zugriff und Identität
isoliert. Selbst wenn jeder Server, den nimimo betreibt,
kompromittiert würde, ließen sich keine Nutzergelder bewegen,
weil die Schlüssel, die eine Bewegung autorisieren, nie
außerhalb des Nutzergeräts existiert haben.

## Money Services Business: FinCEN (US-Bundesebene)

Die FinCEN-Registrierung als MSB greift bei Einrichtungen, die
Money Transmitter, Devisenhändler, Scheckeinreicher,
Prepaid-Access-Anbieter oder Ähnliches sind. nimimo ist nichts
davon. Es tauscht keine Währungen, emittiert keinen Prepaid-Wert,
handelt nicht mit Fiat-Instrumenten und überträgt keinen Wert im
oben genannten Sinn.

Die Identitätsachse ist das Einzige, das nimimo „betreibt", und
Identität bedeutet in nimimo einen Namen, der auf vom Nutzer
kontrollierte Adressen zeigt. Das Betreiben eines Naming-Resolvers
ist keine Geldtransferdienstleistung.

## Crypto-Asset Service Provider: MiCA (EU)

Die MiCA-CASP-Definition ist um Verwahrung, Tausch, Übertragung,
Platzierung, Beratung, Portfolioverwaltung und ähnliche
Dienstleistungen herum gebaut, die *für oder im Auftrag von*
Kunden erbracht werden. nimimo erbringt keine dieser
Dienstleistungen. Die Eigentumsachse liegt auf dem Gerät des
Nutzers; nimimo kann keine Krypto-Assets im Auftrag von Kunden
halten, weil es keinen Mechanismus besitzt, sie überhaupt zu
halten.

Konkret erbringt nimimo nicht:

- Verwahrung und Verwaltung von Krypto-Assets. Schlüssel sind
  gerätelokal und werden niemals übertragen.
- Betrieb einer Handelsplattform. Es gibt kein Orderbuch, keine
  Matching-Engine, keinen Marktplatz.
- Tausch von Krypto-Assets gegen Gelder oder andere
  Krypto-Assets. Im System existiert keine Tausch-Logik.
- Ausführung von Orders, Platzierung oder Überweisungs-
  dienstleistungen. nimimo führt nie etwas aus; die Wallet des
  Nutzers führt aus.
- Entgegennahme, Übermittlung oder Beratung. nimimo erteilt
  keine Beratung und nimmt keine Orders entgegen.

## Virtual Asset Service Provider: FATF-Empfehlung 15

Die FATF-VASP-Definition entspricht zum Zweck internationaler
AML-Standards im Wesentlichen der MiCA-CASP-Definition. Es gilt
dieselbe strukturelle Argumentation: nimimo tauscht, überträgt,
hält, verwaltet oder beteiligt sich nicht an der Ausgabe
virtueller Vermögenswerte im Auftrag von Nutzern. Es löst einen
menschenlesbaren Namen in eine öffentliche Adresse auf, die der
Nutzer selbst kontrolliert.

## Zahlungsdienstleister / Zahlungsinstitut

Zahlungsabwicklung verlangt, dass der Betreiber im Wertpfad
sitzt. nimimo tut das nicht. Eine Zahlung an `@lucky-mountain`
ist eine gewöhnliche On-Chain-Überweisung von der Wallet des
Senders an die selbstverwahrte Adresse des Empfängers. nimimo
wickelt nie ab, clearing nicht, hält keinen Float, gibt keine
Autorisierung aus und garantiert keine Transaktion. Das Handle
ist ein Lookup; die Abwicklung ist das, was die zugrundeliegende
Blockchain leistet.

## Börse / Handelsplatz

Eine Börse matched Käufer und Verkäufer und betreibt ein
Orderbuch. nimimo hat kein Orderbuch, keine Quotes, keine
Matching-Engine, keinen Spread, kein Konzept von „Handelspaaren"
und keine Gebühren auf Trades. Zwei Nutzer können innerhalb von
nimimo keinen Vermögenswert gegen einen anderen tauschen, weil
nimimo keine Handels-Primitive besitzt.

## Creator-Monetarisierung (Trinkgelder, bezahlte Inhalte)

nimimo-Profile können Trinkgelder empfangen, Inhalte (Bilder,
Dokumente, Links) gegen On-Chain-Zahlung verkaufen und
Direktzahlungen annehmen. Diese Funktionen ändern nichts an der
obigen regulatorischen Analyse. Die strukturellen Eigenschaften
sind:

1. **Trinkgelder** sind direkte On-Chain-Transfers von der Wallet
   des Absenders an die selbstverwahrte Adresse des Creators.
   nimimo löst den Namen auf und stellt eine Zahlungsoberfläche
   bereit; die Transaktion wird mit den eigenen Schlüsseln des
   Absenders signiert und von der Chain abgewickelt. Kein Wert
   fließt durch nimimo. Keine Gebühr wird erhoben.

2. **Bezahlte Inhalte** folgen demselben Pfad: Der Absender
   zahlt direkt an die Adresse des Creators. Der Creator legt
   einen Preis in USD fest; der Absender zahlt den Gegenwert im
   nativen Asset der Chain. nimimo verifiziert die On-Chain-Zahlung
   und gewährt Zugang zum Inhalt. Aktuell wird keine Gebühr
   erhoben.

3. **Intents** sind strukturierte Zahlungsanfragen, die
   Drittanbieter-Apps über die öffentliche API erstellen können.
   Ein Intent ist ein Datensatz, der auf einen Empfänger-Handle,
   eine Chain und einen Betrag verweist. Er wird zum selben
   direkten On-Chain-Transfer aufgelöst wie oben beschrieben.
   nimimo erstellt den Intent-Datensatz; die Wallet des Absenders
   führt die Transaktion aus und signiert sie.

In allen drei Fällen bleibt nimimo der Resolver, nicht der
Transporteur. Die Wallet des Absenders signiert die Transaktion,
die Chain wickelt sie ab, und die selbstverwahrte Adresse des
Empfängers erhält die Mittel. nimimo hält, leitet oder
vermittelt niemals Werte.

Falls in Zukunft eine Plattformgebühr eingeführt wird, werden die
regulatorischen Implikationen dieser Gebührenstruktur separat
bewertet und dokumentiert. Die aktuelle Architektur ist gebührenfrei.

## Wertpapieremittent / Broker-Dealer

nimimo hat keinen Token. Es gibt keinen Anspruch, kein Eigenkapital,
kein Stimmrecht, keine Gewinnbeteiligung, keinen Anlagevertrag
und keine an nimimo gekoppelte Renditeerwartung. Das Produkt ist
eine kostenlose Identitätsschicht. Es gibt nichts zu emittieren,
nichts zu vermitteln und nichts zu handeln.

## E-Geld-Institut

E-Geld-Institute geben elektronischen Wert aus, der zum Nennwert
einlösbar ist. nimimo gibt keinerlei Wert aus. Die Blockchains, auf
die nimimo auflöst (Bitcoin, Ethereum, Solana), geben ihre
nativen Vermögenswerte unabhängig aus; nimimo gibt keinen davon
aus und löst keinen davon ein.

## KYC- / AML-pflichtige Einrichtung

KYC- und AML-Pflichten greifen bei Einrichtungen, die regulierte
Tätigkeiten ausführen (Verwahrung, Übermittlung, Tausch etc.).
Da nimimo keine dieser Tätigkeiten ausführt, ist es für diese
Tätigkeiten nicht die verpflichtete Einrichtung. nimimo erhebt
bei der Anmeldung eine E-Mail-Adresse, um Zugriff zu
ermöglichen; diese E-Mail ist an keinen Wertfluss gebunden,
weil es keinen Wertfluss gibt.

Das ist keine Behauptung, dass AML-Regeln im Kryptobereich
allgemein irrelevant wären. Sie gelten für denjenigen, der die
regulierte Tätigkeit tatsächlich ausführt, und das ist im Fall
von nimimo *die Wallet, die der Sender ohnehin benutzt*, nicht
nimimo.

## Bankgeschäft / Einlagengeschäft

Einlagengeschäft erfordert die Annahme von Geldern der
Öffentlichkeit auf rückzahlbarer Basis. nimimo nimmt keine
Gelder an. Es gibt nichts zurückzuzahlen, weil nie etwas
entgegengenommen wurde.

## Anlageberater / Portfolioverwalter

Anlageberatung umfasst personalisierte Empfehlungen zu
Wertpapieren oder Vermögenswerten. nimimo spricht keine
Empfehlungen aus und verwaltet keine Portfolios. Die
Identitätsachse stellt keine Beratung dar.

---

## Was die vier Achsen garantieren

Die strukturelle Garantie ist einfach und folgt unmittelbar aus
der Trennung der Achsen:

1. **Zugriff** trägt keine Autorität. Eine kompromittierte
   Zugriffsmethode kann keine Gelder bewegen, keine Identität
   ändern und keine Wiederherstellung auslösen.
2. **Eigentum** ist kryptografisch und gerätelokal. nimimo
   besitzt keinen Mechanismus, es zu halten, zu bewegen oder
   wiederherzustellen.
3. **Identität** ist referenziell. Sie zeigt auf Eigentum, kann
   es aber nicht überschreiben.
4. **Wiederherstellung** ist nutzerinitiiert, lokal
   verschlüsselt und unabhängig vom Zugriff. nimimo kann weder
   ein Wiederherstellungsartefakt erzeugen noch anwenden.

Die vollständige Zustandsraumanalyse in
[`sixteen-states.md`](./sixteen-states.md) zeigt, warum jeder
kollabierte Zustand, also jene Zustände, in denen eine Achse
Autorität über eine andere erlangt, genau die Konfiguration
darstellt, die regulierte Tätigkeit erzeugt. nimimo hält den
einzigen Zustand aufrecht, in dem alle vier Achsen ohne Kollaps
koexistieren: `(1,1,1,1)`, den getrennten Vollzustand.

---

## Zum Thema Prüfung

Wenn eine Aufsichtsbehörde, ein Prüfer oder eine Gegenpartei
nimimo untersucht, ist das Ziel, dass die Untersuchung
ereignislos verläuft. Nicht weil nimimo etwas versteckt hätte,
sondern weil die Architektur so entworfen wurde, dass es nichts
zu finden gibt. Die Schlüssel sind nicht auf dem Server. Die
Gelder sind nicht in nimimos Verwahrung. Die Orders werden nicht
im Backend von nimimo gematched. Der Token existiert nicht. Die
Beratung wird nicht erteilt. Die Einlagen werden nicht
angenommen.

So sieht eine saubere Trennung der Zuständigkeiten aus,
angewandt auf eine Domäne, die sich historisch geweigert hat,
sie zu trennen. Es ist der Zustand, in dem Krypto-Identität von
Anfang an hätte sein sollen.
