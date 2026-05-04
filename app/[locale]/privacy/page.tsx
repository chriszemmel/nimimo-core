import type { Metadata } from "next"
import { Footer } from "@/components/footer"
import { ContactLink } from "@/components/contact-link"

export const metadata: Metadata = {
  title: "Privacy Policy | nimimo",
  description: "Privacy policy for nimimo - self-custodial crypto identity platform.",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12 max-w-2xl">
          <h1
            className="text-2xl font-bold text-foreground mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Privacy Policy
          </h1>
          <p className="text-xs text-muted-foreground mb-8">Last updated: April 5, 2026</p>

          <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">1. Overview</h2>
              <p>
                nimimo is designed with privacy at its core. As a self-custodial platform, we minimize data collection by design. This policy explains what we collect, why, and how it is used.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">2. What We Collect</h2>
              <div className="space-y-3 mt-3">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Account data</h3>
                  <p>Email address (for authentication via magic link). No passwords are stored.</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">Identity data</h3>
                  <p>Your chosen handle, bio, avatar image, and profile template preferences.</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">Public blockchain addresses</h3>
                  <p>Your Bitcoin, Ethereum, and Solana public addresses are stored to enable handle resolution. These are public on-chain data by nature.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">3. What We Do NOT Collect</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Private keys or seed phrases (encrypted on your device only)</li>
                <li>Financial data or transaction history</li>
                <li>Location data</li>
                <li>Tracking cookies or advertising identifiers</li>
                <li>Data from third-party analytics services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">4. Cryptographic Keys</h2>
              <p>
                Your seed phrase is encrypted using device-bound keys and stored exclusively in your browser&apos;s IndexedDB. nimimo servers never receive, store, or have access to your seed phrase or private keys. This is a fundamental design principle, not a policy choice.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">5. How We Use Your Data</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Email: to authenticate your session via magic link</li>
                <li>Handle + addresses: to provide public handle resolution (the core service)</li>
                <li>Profile data: to render your public profile page</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">6. Data Storage</h2>
              <p>
                Account and identity data is stored in a PostgreSQL database hosted on Neon (cloud). Session data uses secure, HTTP-only cookies. Avatar images are stored on Cloudflare R2. All connections use TLS encryption.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">7. Third-Party Services</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Neon (database hosting)</li>
                <li>Vercel (application hosting)</li>
                <li>Cloudflare R2 (avatar storage)</li>
                <li>CoinGecko (cryptocurrency price data - no user data shared)</li>
                <li>Blockchain RPC providers (Alchemy, Blockstream - only public address queries)</li>
              </ul>
              <p className="mt-2">
                We do not sell, share, or provide your personal data to advertisers or data brokers.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">8. Data Retention</h2>
              <p>
                Account data is retained as long as your account is active. Public address and handle data remains available for resolution purposes. You may request deletion of your account and associated data by contacting us.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">9. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your account and data</li>
                <li>Export your data</li>
              </ul>
              <p className="mt-2">
                To exercise these rights,{" "}
                <ContactLink topic="Privacy" className="underline hover:text-foreground transition-colors">
                  contact us
                </ContactLink>.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">10. Children</h2>
              <p>
                nimimo is not intended for use by individuals under 16 years of age. We do not knowingly collect data from children.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">11. Changes</h2>
              <p>
                We may update this policy from time to time. Changes will be reflected on this page with an updated date.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-foreground mb-2">12. Contact</h2>
              <p>
                For privacy-related questions,{" "}
                <ContactLink topic="Privacy" className="underline hover:text-foreground transition-colors">
                  contact us
                </ContactLink>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
