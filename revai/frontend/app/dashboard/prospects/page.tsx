"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { Play, Loader2, CheckCircle2, ChevronRight, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { StatusChip } from "@/components/ui/status-chip"
import { SlideOverDrawer } from "@/components/ui/slide-over-drawer"

// Mock fetchers (Connect to actual APIs later)
const fetchProspects = async () => {
  // In actual implementation this calls GET /api/prospects
  return []
}

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<any[]>([])
  const [isResearching, setIsResearching] = useState(false)
  const [selectedProspect, setSelectedProspect] = useState<any | null>(null)

  // Form Handle
  const handleRunResearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsResearching(true)

    const form = e.currentTarget
    const formData = new FormData(form)

    const payload = {
      company_name: formData.get("company_name"),
      domain: formData.get("domain"),
      contact_name: formData.get("contact_name"),
      contact_email: formData.get("contact_email"),
      use_icp_from_settings: formData.get("use_icp") === "on"
    }

    // Simulate API call POST /api/prospects/research and polling
    setTimeout(() => {
      const mockNewProspect = {
        id: Math.random().toString(),
        company_name: payload.company_name,
        contact_name: payload.contact_name,
        contact_email: payload.contact_email,
        icp_score: 85,
        status: "qualified",
        fit_signals: ["High Growth", "B2B SaaS", "Using Hubspot"],
        sequences: [
          {
            steps: [
              { subject: "Quick question about sales", "body": "Hi, saw your growth..." },
              { subject: "Following up", "body": "Any thoughts on my previous email?" }
            ]
          }
        ]
      }
      setProspects(prev => [mockNewProspect, ...prev])
      setIsResearching(false)
      form.reset()
    }, 2000)
  }

  return (
    <div className="flex h-full w-full gap-6">
      {/* Left Panel - Run Research Form */}
      <div className="w-[320px] shrink-0 border-r pr-6 flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Run Research</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Trigger the Intelligence Agent to analyze a new prospect.
          </p>
        </div>

        <form onSubmit={handleRunResearch} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company_name">Company Name</Label>
            <Input id="company_name" name="company_name" placeholder="e.g. Acme Corp" required disabled={isResearching} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="domain">Domain (Optional)</Label>
            <Input id="domain" name="domain" placeholder="e.g. acme.com" disabled={isResearching} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_name">Contact Name</Label>
            <Input id="contact_name" name="contact_name" placeholder="e.g. Alice Smith" required disabled={isResearching} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_email">Contact Email</Label>
            <Input id="contact_email" name="contact_email" type="email" placeholder="e.g. alice@acme.com" required disabled={isResearching} />
          </div>

          <div className="flex items-center justify-between py-2">
            <Label htmlFor="use_icp" className="text-sm">Use ICP from settings</Label>
            <Switch id="use_icp" name="use_icp" defaultChecked disabled={isResearching} />
          </div>

          <Button type="submit" className="w-full" disabled={isResearching}>
            {isResearching ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
            ) : (
              <><Play className="mr-2 h-4 w-4" /> Run Agent</>
            )}
          </Button>
        </form>
      </div>

      {/* Main Area - Prospects Table */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Prospects Pipeline</h2>
        </div>

        <div className="rounded-md border bg-card/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>ICP Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fit Signals</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prospects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No prospects found. Run research to add some.
                  </TableCell>
                </TableRow>
              ) : (
                prospects.map((p, i) => (
                  <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedProspect(p)}>
                    <TableCell className="font-medium">{p.company_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{p.contact_name}</span>
                        <span className="text-xs text-muted-foreground">{p.contact_email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.icp_score > 70 ? "success" : p.icp_score > 30 ? "warning" : "destructive"}>
                        {p.icp_score}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={p.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {p.fit_signals?.map((s: string, j: number) => (
                          <Badge key={j} variant="outline" className="text-[10px] whitespace-nowrap">{s}</Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Right Drawer */}
      <SlideOverDrawer
        open={!!selectedProspect}
        onClose={() => setSelectedProspect(null)}
        title="Prospect Intelligence"
      >
        {selectedProspect && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="space-y-1">
              <h3 className="text-xl font-bold">{selectedProspect.contact_name}</h3>
              <p className="text-muted-foreground">{selectedProspect.contact_email} • {selectedProspect.company_name}</p>
            </div>

            {/* ICP Stats */}
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">ICP Match Score</span>
                <Badge variant={selectedProspect.icp_score > 70 ? "success" : "warning"} className="text-sm px-3">
                  {selectedProspect.icp_score} / 100
                </Badge>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-2">Key Fit Signals</span>
                <div className="flex gap-2 flex-wrap">
                  {selectedProspect.fit_signals?.map((s: string, j: number) => (
                    <Badge key={j} variant="outline" className="bg-background">{s}</Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Generated Sequence */}
            {selectedProspect.sequences && selectedProspect.sequences.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm border-b pb-2">AI Generated Sequence</h4>
                <div className="space-y-4">
                  {selectedProspect.sequences[0].steps.map((step: any, idx: number) => (
                    <div key={idx} className="border rounded-md p-3 relative bg-card text-sm">
                      <div className="absolute -left-2 -top-2 bg-primary text-primary-foreground h-5 w-5 flex items-center justify-center rounded-full text-xs font-bold">
                        {idx + 1}
                      </div>
                      <div className="font-medium mb-1 truncate text-xs pt-1">Subject: {step.subject}</div>
                      <p className="text-muted-foreground text-xs line-clamp-3">{step.body}</p>
                    </div>
                  ))}
                </div>
                <div className="pt-4 flex gap-3">
                  <Button className="w-full flex-1"><CheckCircle2 className="w-4 h-4 mr-2" /> Approve</Button>
                  <Button variant="outline" className="w-full flex-1"><XCircle className="w-4 h-4 mr-2" /> Reject</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </SlideOverDrawer>
    </div>
  )
}