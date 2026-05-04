# Ethik

> **Author:** Chris Zemmel · **First published:** 2026 · **License:** [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/) · **Cite:** [`CITATION.cff`](../../CITATION.cff)

*Die Werte, die die Architektur geprägt haben, die Non-Features
und die Weigerung, etwas anderes zu werden.*

Die übrigen Papers dieses Korpus beschreiben, was nimimo ist und
wie es funktioniert. Dieses Dokument beschreibt, warum gerade
diese Entscheidungen getroffen wurden und welche ethische Position
darin steckt. Es ist das Gegenstück zu
[`author.md`](./author.md), und beide sollten zusammen gelesen
werden. Die Architektur ist nicht trennbar von der Person, die
sie entworfen hat, und die folgenden Werte sind nicht trennbar
von den Rahmenbedingungen, die das Projekt überhaupt erst möglich
gemacht haben.

Jeder Abschnitt ist eine Position. Zusammen erklären sie, warum
die Non-Features in [`non-features.md`](./non-features.md) keine
Roadmap-Lücken sind, sondern Zusagen, und warum die
regulatorische Haltung in
[`regulatory-posture.md`](./regulatory-posture.md) keine clevere
Rahmung ist, sondern eine strukturelle Eigenschaft des Designs.

---

## Verwahrung ist eine moralische Position, keine UX-Entscheidung

Die Entscheidung, niemals Nutzerschlüssel zu halten, geht nicht in
erster Linie um Bequemlichkeit oder regulatorische Exposition. Sie
ist eine Weigerung, nimimo in eine Lage zu bringen, aus der es
gezwungen, genötigt, gehackt oder durch ein künftiges Ich
korrumpiert werden könnte, das zu nehmen, was den Nutzern
gehört. Sobald du deine Nutzer verraten *kannst*, beruht das
System auf der Annahme, dass du es nicht tun wirst. nimimo
verweigert es, auf dieser Annahme gebaut zu sein. Die
Vier-Achsen-Trennung in [`four-axes.md`](./four-axes.md) ist der
technische Ausdruck dieser Position: nimimo kann seine Nutzer
nicht verraten, weil es die Fähigkeit dazu nicht besitzt.

## Kein Token ist eine Weigerung der Fehlanreize

Ein Token würde eine Klasse von Stakeholdern schaffen, deren
Interessen nicht mit den Interessen der Nutzer übereinstimmen.
Token-Halter wollen Preisanstieg; Nutzer wollen ein
funktionierendes Produkt. Token-Launches belohnen frühe
Spekulanten auf Kosten späterer Anwender. Governance-Token
erzeugen theaterhafte Abstimmungsstrukturen, die die Macht bei
denen konzentrieren, die am meisten halten. Keine dieser
Dynamiken dient den Menschen, die einfach nur einen Namen wollen,
an den man sie bezahlen kann. nimimo hat keinen Token und wird
auch niemals einen haben. Eigenkapital-Investoren hingegen sind
auf das operative Geschäft und auf eine breite Nutzeradoption
ausgerichtet, eine qualitativ andere Beziehung als
Token-Spekulation, und eine, für die das Projekt aktiv offen ist.

## Kapital ist willkommen, wenn es mit der Mission übereinstimmt

nimimo ist offen für externe Investitionen, Pre-Seed und darüber
hinaus, ebenso wie für strategische Partnerschaften und
Übernahmegespräche. Das erklärte Ziel, Krypto für die nächsten
Milliarden Menschen nutzbar zu machen, ist größer als die
Fähigkeit eines einzelnen Gründers, es aus eigener Kraft zu
stemmen, und Kapital, das diese Ambition teilt, ist willkommen.
Die Architektur wurde darauf ausgelegt zu skalieren, und die
Person dahinter ist bereit, mit ihr zu skalieren.

Die Ausrichtungslatte für jedes Investment, jede Partnerschaft
oder Übernahme ist dieselbe wie für jedes neue Feature:

1. Hilft es, mehr Menschen zu erreichen, die von einer
   nicht-verwahrenden Identitätsschicht für Krypto profitieren
   würden?
2. Bewahrt es die Vier-Achsen-Trennung, die Abwesenheit eines
   Tokens und die Non-Features-Liste?
3. Sind die Verpflichtungen, die es schafft, mit den Werten in
   diesem Dokument vereinbar?

Kapital, das diese Latte erreicht, ist genau das Kapital, das
nimimo sucht. Die Ausrichtungskriterien hier schriftlich
festzuhalten, soll Gespräche beschleunigen, nicht abschrecken:
Gründer und Investoren sehen von vornherein, worauf nimimo
optimiert, und die meisten gut ausgerichteten
Krypto-Infrastrukturfonds werden diese Werte als normale Hygiene
statt als Reibung erkennen. Kontakte zu Pre-Seed- und
Seed-Investoren, strategischen Partnern und potenziellen
Erwerbern sind ausdrücklich willkommen.

Ein konkretes Szenario, das ausdrücklich willkommen ist: Ein
größerer Akteur, eine Wallet, eine Börse oder ein anderer
regulierter Betreiber, übernimmt nimimo als Identitäts- und
UX-Schicht, möglicherweise in Kombination mit seinem bestehenden
Onboarding, seinen Fiat-Rails oder seinen Wiederherstellungs-
Flows. Die meisten Punkte in
[`non-features.md`](./non-features.md), Fiat-On/Off-Ramps,
verwahrende Wiederherstellungspfade, KYC-Onboarding, auch
Swap- und Staking-Oberflächen, existieren bereits innerhalb
solcher regulierter Betreiber. Die Kombination von nimimos
Identitätsprimitiv mit diesen regulierten Flows, besonders mit
Onboarding, ist ein qualitativ anderes Produkt als jede Seite
für sich. Der Autor ist offen für genau diese Art von Gespräch,
einschließlich einer Übernahme, und auch dafür, direkt daran
mitzuwirken, die Integrationspunkte zu lösen, die über die
Non-Feature-Grenze hinwegreichen. Die Non-Features sind eine
Absage an nimimo, das sie *isoliert selbst* baut, nicht die
Behauptung, dass diese Fähigkeiten nimimo von außen niemals
berühren dürfen. Regulatorik ist in diesem Territorium eine
reale Frage, aber sie ist nicht der Fokus des Autors, und ein
Erwerber, der bereits innerhalb eines regulierten Perimeters
arbeitet, ist genau die richtige Partei, um sie zu tragen.

## Solo-Entwicklung ist eine Position der Verantwortung

Eine einzige, namentlich genannte Person hat nimimo entworfen
und gebaut. Es gibt kein „das Team", hinter dem man sich
verstecken könnte, keine diffus verteilte Verantwortung, kein
anonymes Gründer-Pseudonym. Wenn etwas nicht stimmt, gibt es
eine verantwortliche Partei, und deren Name steht in
[`author.md`](./author.md) und in diesem Korpus. Verantwortung
ohne Verschleierung ist selbst eine ethische Position; sie ist
das Gegenteil des üblichen Krypto-Musters „wir sind eine DAO"
oder „wir sind eine Stiftung in der Schweiz".

## Non-Features sind Zusagen, keine Lücken

Die Liste in [`non-features.md`](./non-features.md) ist keine
Roadmap von Dingen, die später hinzugefügt werden sollen. Jeder
Punkt ist eine Zusage, dieses Ding *nicht* zu bauen, selbst
wenn es Umsatz bringen würde, selbst wenn Nutzer danach fragen,
selbst wenn Wettbewerber es anbieten. Ein verwahrender Fallback
würde Gebühren generieren. Ein Swap würde Volumen generieren.
Ein Token würde Fundraising freischalten. Jede Weigerung ist
eine bewusste Entscheidung, eng und nützlich zu bleiben, statt
in angrenzende Kategorien zu expandieren, die die Architektur
kompromittieren würden.

## Monetarisierung ohne Verwahrung

nimimo-Profile können Trinkgelder empfangen, Inhalte verkaufen
und Direktzahlungen annehmen. In jedem Fall geht das Geld an die
eigene Adresse des Creators, on-chain, ohne durch nimimo zu
fließen. Dies ist das einzige Monetarisierungsmodell, das mit der
obigen Verwahrungsposition vereinbar ist: In dem Moment, in dem
nimimo Nutzergelder hält, und sei es nur kurz, kollabiert die
strukturelle Garantie.

Trinkgelder haben keine Plattformgebühr. Trinkgelder zu
beschneiden wäre wie das Abzweigen der Trinkgelder eines Kellners:
strukturell möglich, aber ethisch nicht vertretbar. Zahlungen für
Inhalte haben aktuell ebenfalls keine Gebühr. Die Priorität
liegt auf Adoption, nicht auf Extraktion.

Falls in Zukunft ein Gebührenmodell eingeführt wird, unterliegt es
derselben Messlatte wie jede andere Designentscheidung: Bewahrt es
die Vier-Achsen-Trennung? Hält es nimimo aus dem Wertpfad heraus?
Kann es umgesetzt werden, ohne Nutzergelder zu halten? Eine
Gebührenstruktur, die einen dieser Tests nicht besteht, wird nicht
ausgeliefert.

## Die Architektur ist die Ethik

Dies ist der wichtigste Satz dieses Dokuments. Die
Vier-Achsen-Trennung ist nicht bloß ein sauberes
Engineering-Muster. Sie ist ein struktureller Ausdruck des
Wertes *„bringe dich nicht in eine Lage, in der du deine Nutzer
verraten kannst"*. Man kann nicht per Gerichtsbeschluss zur
Herausgabe von Schlüsseln gezwungen werden, die man nie gehalten
hat. Man kann nicht zur Rückabwicklung von Transaktionen
genötigt werden, die man nie abgewickelt hat. Man kann nicht
dazu kompromittiert werden, Konten leerzuräumen, deren
Eigentumsmaterial nie auf den eigenen Servern war. Die
Architektur entfernt die *Fähigkeit*, Schaden anzurichten, nicht
nur die Absicht. Absicht ist zerbrechlich. Fähigkeitsgrenzen sind
es nicht.

## Der Name ist ein Primitiv *und* ein Produkt

Namen sind soziale Infrastruktur. Sie sollten nicht einer Firma
gehören, die sie widerrufen, die Regeln ändern oder sie an den
Höchstbietenden verkaufen kann. nimimos Position ist, dass
Krypto-Identität portabel, kostenlos und von jedem auflösbar
sein sollte, näher an DNS als an einem SaaS-Konto.

Diese Zusage gilt heute mit unterschiedlicher Stärke auf zwei
Ebenen. Auf der **Eigentums**-Ebene ist sie bereits absolut: Die
Schlüssel liegen auf dem Gerät des Nutzers, die Adressen werden
aus dem Seed des Nutzers abgeleitet, und die Vermögenswerte, die
diese Adressen kontrollieren, liegen auf ihren jeweiligen
Blockchains. Würde nimimo morgen verschwinden, hielten die Nutzer
weiterhin ihren Seed, könnten ihn in jede kompatible Wallet
importieren und weiterhin von denselben Adressen aus senden.
Nichts daran erfordert die Kooperation von nimimo, es ist eine
strukturelle Eigenschaft der Eigentumsachse in
[`four-axes.md`](./four-axes.md), kein Versprechen.

Auf der **Namens**-Ebene ist die Zusage eher eine
Entwicklungsrichtung als eine fertige Eigenschaft. Der Resolver
ist öffentlich und das Auflösungsformat ist offen, aber die
Zuordnung von Handle zu Eigentümer ist heute operativ ein
Datenbankeintrag auf nimimos Infrastruktur. Würde nimimo
verschwinden und gäbe es kein anderweitig gespiegeltes Abbild
dieser Zuordnung, behielten die Nutzer ihre Schlüssel und ihr
Geld, die *Namens*-Bindung müsste jedoch anderswo neu etabliert
werden, um wieder auflösbar zu sein. Die Namens-Ebene ebenso
dauerhaft zu machen wie die Eigentums-Ebene ist eine Richtung,
über die der Autor nachgedacht hat, und es gibt dafür tragfähige
Formen, die die Vier-Achsen-Trennung bewahren. Die ehrliche
Aussage für heute lautet: Der Name ist auf dem Weg zu einem
Primitiv, aber noch nicht dort.

Gleichzeitig liefert nimimo ein Produkt auf diesen Ebenen,
Profilseiten, Avatare, Status, Templates, die
`Send to @handle`-Oberfläche, die Pay-URL. Diese Produktschicht
ist heute operativ zentralisiert, weil eine einzelne Person sie
baut (siehe „Solo-Entwicklung ist eine Position der
Verantwortung" oben), und das ist in Ordnung. Die architektonische
Regel lautet nicht *„der Name darf niemals ein Produkt sein"*; die
Regel lautet *„der Name als Produkt darf nicht in Autorität
eskalieren."* Die Vier-Achsen-Trennung in
[`four-axes.md`](./four-axes.md) ist das, was diese Garantie
strukturell statt nur versprochen macht.

Die beiden Ebenen dienen einander. Das Eigentums-Primitiv ist es,
das das Produkt nicht-zwingend hält: Nutzer können jederzeit mit
ihren Schlüsseln und ihrem Geld gehen, mit oder ohne Kooperation
von nimimo. Das Produkt ist es, das das Primitiv überhaupt erst
adoptierbar macht: ohne die `Send to @name`-Oberfläche und die
Profilseite ist das Primitiv eine Spezifikation, die niemand
benutzt. Beide als Gegner zu sehen, war die alte Rahmung. Sie
sind dieselbe Zusage auf zwei Höhenlagen, auf jeder ehrlich
benannt.

## Die Beschränkung auf eine Person war produktiv

Solo-Entwicklung wird gewöhnlich als Einschränkung dargestellt.
Für die Spezifikationsphase war sie das Gegenteil. Die
Spezifikation musste *klein* sein, bevor sie etwas anderes sein
konnte, und ein einzelner Bauender mit klarer These konnte sie
eng halten, so eng, wie jede Team-Struktur natürlicherweise
wieder aufweicht. Eine einzelne Person, die sich Vollzeit dem
Design widmete, konnte jedes angrenzende Feature außen vor lassen,
bis die Kernarchitektur fertig war. Das 16-Wochen-Fenster zwischen
dem ersten Whitepaper (16.12.2025) und dem Release von v1.0.0
(07.04.2026) ist das gesamte Zeitfenster des Baus. Nichts wurde
überstürzt; nichts wurde hinzugefügt, das die Spezifikation nicht
verlangt hätte. Die weitere Skalierung des Projekts, durch
Kapital, Partnerschaft oder Einstellungen, ist die nächste
Phase, geregelt durch die oben genannte Ausrichtungslatte, und
eine Phase, auf die das Projekt vorbereitet ist.

---

## Warum das zählt

Krypto hat eine Geschichte von Projekten, die Werte behauptet
haben, die sie strukturell nicht eingehalten haben.
„Dezentrale" Plattformen mit Admin-Schlüsseln.
„Nicht-verwahrende" Wallets, die stillschweigend Gelder über
ihre eigenen Server leiten. „Community-owned" Protokolle, deren
Tokens zu 80 % von Insidern gehalten werden. „Offene" Systeme,
deren APIs Berechtigung erfordern. nimimos Position ist, dass
die einzige ehrliche Aussage jene ist, die die Architektur nicht
verraten kann.

Wenn ein Wert zählt, sollte er durch die Form des Systems
durchgesetzt werden, nicht durch das Versprechen der Menschen,
die es betreiben. Die Papers in diesem Korpus beschreiben ein
System, in dem die Werte und die Architektur dasselbe sind.
Zusammen gelesen sollten
[`four-axes.md`](./four-axes.md),
[`sixteen-states.md`](./sixteen-states.md),
[`access-primitive.md`](./access-primitive.md),
[`regulatory-posture.md`](./regulatory-posture.md),
[`non-features.md`](./non-features.md) und
[`author.md`](./author.md) klar machen, dass die
Designentscheidungen und die Ethik untrennbar sind, und dass
beide von einer einzigen Person stammen, die es sich leisten
konnte, sie zu treffen.
