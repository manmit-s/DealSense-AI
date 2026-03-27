"use client"
import * as React from "react"
import { LucideIcon } from "lucide-react"

export function StatusChip({ status }: { status: string }) {
    const normalizedStatus = status.toLowerCase()
    let colorClass = "bg-gray-100 text-gray-800 border-gray-200"

    if (normalizedStatus === "researching") colorClass = "bg-blue-100 text-blue-800 border-blue-200"
    else if (normalizedStatus === "qualified") colorClass = "bg-green-100 text-green-800 border-green-200"
    else if (normalizedStatus === "disqualified") colorClass = "bg-red-100 text-red-800 border-red-200"

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    )
}
