# Die vier Achsen von nimimo

> **Author:** Chris Zemmel · **First published:** 2026 · **License:** [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/) · **Cite:** [`CITATION.cff`](../../../CITATION.cff)

*Eine strukturierte Erklärung von Zugriff, Eigentum, Identität und Wiederherstellung.*

## Überblick

nimimo ist um eine bewusste Trennung der vier grundlegenden
Achsen entworfen, die für die menschliche Interaktion mit
kryptografischen Systemen erforderlich sind. Diese Achsen sind
**Zugriff**, **Eigentum**, **Identität** und **Wiederherstellung**.
Jede Achse erfüllt eine eigenständige Rolle und ist absichtlich
daran gehindert, Autorität in eine andere zu eskalieren.

Dieses Dokument definiert jede Achse. Die begleitenden Papers
[`sixteen-states.md`](./sixteen-states.md) und
[`access-primitive.md`](./access-primitive.md) untersuchen den
vollständigen Zustandsraum der vier Achsen beziehungsweise die
formalen Eigenschaften der Zugriffsachse für sich genommen.

---

## 1. Zugriff

**Definition.** Zugriff ist die Fähigkeit, auf einem bestimmten
Gerät eine Sitzung innerhalb von nimimo zu eröffnen.

- Zugriff erlaubt Interaktion mit der Oberfläche, verleiht aber
  keine Autorität.
- Zugriffsmethoden sind austauschbar und nicht dauerhaft.
- Der Verlust von Zugriff bedeutet nicht den Verlust von Eigentum.

```ts
// lib/auth.ts - NextAuth-Session-Callback
async session({ session, user }) {
  if (session.user && user) {
    session.user.id = user.id
  }
  return session
},
```

Der Session-Callback ist die einzige Stelle, an der ein Session-Objekt
für den Client zusammengestellt wird. Er hängt eine undurchsichtige
`user.id` und nichts weiter an, keine Schlüssel, kein Signiermaterial,
keine implizite Autorität.

## 2. Eigentum

**Definition.** Eigentum ist die kryptografische Kontrolle über
private Schlüssel, die lokal auf dem Gerät des Nutzers erzeugt
und gespeichert werden.

- Umfasst private Schlüssel und daraus abgeleitete Wallet-Adressen
  (Protokoll-Identitäten).
- Schlüssel werden niemals an nimimo übertragen oder dort
  gespeichert.
- Eigentum existiert unabhängig von Zugriff oder Identität.

```ts
// lib/ownership/v1/derive.ts - Multi-Chain-Adressableitung, läuft auf dem Gerät des Nutzers
export async function deriveV1Addresses(seedPhrase: string): Promise<AddressDerivationResult> {
  try {
    const seed = await bip39.mnemonicToSeed(seedPhrase)
    const masterKey = HDKey.fromMasterSeed(new Uint8Array(seed))

    const addresses: DerivedAddress[] = []

    for (const chain of MANDATORY_V1_CHAINS) {
      let address: string
      if (chain.chain === "bitcoin") {
        const hdKey = masterKey.derive(chain.derivationPath)
        address = await deriveBitcoinAddress(hdKey)
      } else if (chain.chain === "ethereum") {
        address = await deriveEthereumAddress(seedPhrase, chain.derivationPath)
      } else if (chain.chain === "solana") {
        address = await deriveSolanaAddress(new Uint8Array(seed))
      } else {
        throw new Error(`Unsupported chain: ${chain.chain}`)
      }
      addresses.push({ chain: chain.chain, symbol: chain.symbol, name: chain.name,
                       address, derivationPath: chain.derivationPath, logo: chain.logo })
    }

    return { success: true, addresses }
  } catch (error) {
    return { success: false, addresses: [], error: String(error) }
  }
}
```

Die Seed-Phrase betritt diese Funktion im Browser und verlässt ihn
nicht. Sie wird in die BIP-32- / ed25519-Ableitung für Bitcoin, Ethereum
und Solana eingespeist, und nur die öffentlichen Adressen werden an die
Seite zurückgegeben.

## 3. Identität

**Definition.** Identität ist eine menschenlesbare Referenz, die
sich in kryptografisches Eigentum auflöst.

- Nutzernamen und Profile dienen als soziale Zeiger, nicht als
  Autorität.
- Identität bleibt über Zugriffsmethoden hinweg bestehen.
- Identität signiert keine Transaktionen und hält keine Guthaben.

**Referenziell heißt nicht nebensächlich.** Die Aussage, dass
Identität keine kryptografische Autorität besitzt, ist eine
*Sicherheits*-Eigenschaft, kein Ranking nach Wichtigkeit. Identität
ist die Oberfläche, die Nutzer tatsächlich berühren: das Handle, das
sie teilen, das Profil, das sie gestalten, das `@name`, das ein
Zahlender eingibt. Eigentum ist die kryptografische Invariante
darunter. Beide Schichten sind tragend; sie tragen unterschiedliche
Lasten. Die Trennung in diesem Dokument verhindert, dass Identität
*zu* Autorität wird, sie degradiert Identität nicht zu bloßer
Infrastruktur.

```ts
// packages/resolve/src/client.ts - Öffentliches resolve() im @nimimo/resolve SDK, ein reiner Lesezugriff
async resolve(handle: string): Promise<ResolveAllResult>
async resolve(handle: string, chain: Chain): Promise<ResolveSingleResult>

async resolve(
  handle: string,
  chain?: Chain,
): Promise<ResolveAllResult | ResolveSingleResult> {
  const params = new URLSearchParams({ handle })
  if (chain) params.set("chain", chain)
  const url = `${this.baseUrl}/api/v1/resolve?${params}`
  return this.fetchWithRetry(url)
}
```

Wallets und Apps von Drittanbietern rufen `resolve(handle)` auf, um
Adressen nachzuschlagen. Das SDK spricht den Read-only-Endpoint
`/api/v1/resolve` an und gibt das Ergebnis zurück. Es signiert nicht,
hält keine Guthaben, authentifiziert nicht, Identität ist ein
Zeiger, keine Autorität.

## 4. Wiederherstellung

**Definition.** Wiederherstellung ist ein optionaler, vom Nutzer
angestoßener Export von verschlüsseltem Eigentumsmaterial.

- Wiederherstellungsartefakte werden lokal erzeugt und mit einem
  vom Nutzer gewählten Passwort verschlüsselt.
- nimimo speichert oder verwaltet niemals Wiederherstellungsmaterial.
- Wiederherstellung verleiht Portabilität, überträgt aber auch
  Verantwortung an den Nutzer.

```ts
// lib/recovery/crypto.ts - Passwort-abgeleiteter Schlüssel mit PBKDF2 + AES-GCM, alles im Browser
export async function derivePinKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const pinBytes = encoder.encode(pin)

  const keyMaterial = await window.crypto.subtle.importKey(
    "raw", pinBytes, "PBKDF2", false, ["deriveKey"]
  )

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 600000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}
```

Das Passwort wird mit 600.000 Runden PBKDF2-SHA-256 gestreckt und dann
an einen AES-256-GCM-Schlüssel für die symmetrische Verschlüsselung der
Wiederherstellungs-Nutzlast gebunden. Jeder Aufruf von
`window.crypto.subtle` läuft im Browser des Nutzers; das Passwort
verlässt nie das Netzwerk, und der Server hat nichts zu vergessen.
(Der interne Parameter heißt aus historischen Gründen `pin`, eine PIN
ist ein Spezialfall eines Passworts; die Implementierung akzeptiert
jede Zeichenkette.)

---

## Vergleichstabelle der Achsen

| Achse             | Zweck                | Kryptografische Autorität |
| ----------------- | -------------------- | ------------------------- |
| Zugriff           | System betreten      | Keine                     |
| Eigentum          | Wert kontrollieren   | Nur Guthaben              |
| Identität         | Menschliche Referenz | Keine                     |
| Wiederherstellung | Eigentum zurückholen | Keine                     |

"Kryptografische Autorität: Keine" bedeutet, dass die Achse aus sich
heraus nicht signieren, Zustand ändern oder Werte bewegen kann. Es
bedeutet nicht, dass die Achse für das Produkt unwichtig ist.
Identität trägt insbesondere keinerlei kryptografische Autorität
*und* den größten Teil der Produktoberfläche, diese Kombination ist
der Sinn, nicht ein Zufall.

Durch die Trennung dieser Achsen erreicht nimimo menschliche
Benutzbarkeit, ohne Verwahrung oder Autorität einzuführen. Jede
Achse existiert eigenständig und interagiert dennoch über klar
definierte, nicht-eskalierende Grenzen mit den anderen.
