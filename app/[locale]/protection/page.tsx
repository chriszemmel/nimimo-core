"use client"

import type React from "react"
import Image from "next/image"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export default function ProtectionPage() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/site-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      if (response.ok) {
        router.push("/")
        router.refresh()
      } else {
        setError("Incorrect password")
      }
    } catch {
      setError("An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-sm">
        <div className="space-y-6">
          <div className="text-center space-y-4">
            <Image src="/logo.png" alt="nimimo" width={64} height={64} className="w-16 h-16 mx-auto" />
            <div>
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">nimimo</h1>
              <p className="mt-2 text-sm text-muted-foreground">Enter password to continue</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter protection password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full h-11 bg-accent hover:bg-accent/90 text-white" disabled={isLoading}>
              {isLoading ? "Verifying..." : "Continue"}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
