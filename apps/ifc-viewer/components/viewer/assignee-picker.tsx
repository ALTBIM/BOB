"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, Users, User, Building2 } from "lucide-react"
import { useViewerStore } from "@/lib/store/viewer-store"
import { viewerApi } from "@/lib/api/viewer-api"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import type { IssueAssignee } from "@/lib/types/participant"

interface AssigneePickerProps {
  value: IssueAssignee | null
  onChange: (assignee: IssueAssignee | null) => void
}

export function AssigneePicker({ value, onChange }: AssigneePickerProps) {
  const params = useParams()
  const projectId = params.projectId as string
  const { participants, setParticipants } = useViewerStore()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"company" | "assignee">("company")
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)

  useEffect(() => {
    const loadParticipants = async () => {
      if (!participants) {
        try {
          const data = await viewerApi.getParticipants(projectId)
          setParticipants(data)
        } catch (error) {
          console.error("Failed to load participants:", error)
        }
      }
    }

    loadParticipants()
  }, [projectId, participants, setParticipants])

  if (!participants) {
    return (
      <Button variant="outline" disabled>
        Loading...
      </Button>
    )
  }

  const selectedCompany = selectedCompanyId ? participants.companies.find((c) => c.id === selectedCompanyId) : null
  const companyUsers = selectedCompanyId
    ? participants.users.filter((u) => u.companyId === selectedCompanyId)
    : participants.users
  const companyRoles = selectedCompanyId
    ? participants.roles.filter((r) =>
        participants.users.some((u) => u.companyId === selectedCompanyId && u.roles.includes(r.id)),
      )
    : participants.roles

  const handleSelectCompany = (companyId: string) => {
    setSelectedCompanyId(companyId)
    setStep("assignee")
  }

  const handleSelectUser = (userId: string) => {
    const user = participants.users.find((u) => u.id === userId)
    if (user) {
      onChange({
        type: "user",
        userId: user.id,
        displayName: user.name,
      })
      setOpen(false)
      setStep("company")
      setSelectedCompanyId(null)
    }
  }

  const handleSelectRole = (roleId: string) => {
    const role = participants.roles.find((r) => r.id === roleId)
    if (role && selectedCompanyId) {
      const company = participants.companies.find((c) => c.id === selectedCompanyId)
      onChange({
        type: "company-role",
        roleId: role.id,
        companyId: selectedCompanyId,
        displayName: `${company?.name} → ${role.name}`,
      })
      setOpen(false)
      setStep("company")
      setSelectedCompanyId(null)
    }
  }

  const handleBack = () => {
    setStep("company")
    setSelectedCompanyId(null)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start bg-transparent">
          {value ? (
            <div className="flex items-center gap-2">
              {value.type === "user" ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              <span className="truncate">{value.displayName}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Select assignee...</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder={step === "company" ? "Search companies..." : "Search assignees..."} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            {step === "company" ? (
              <CommandGroup heading="Companies">
                {participants.companies.map((company) => (
                  <CommandItem key={company.id} onSelect={() => handleSelectCompany(company.id)}>
                    <Building2 className="h-4 w-4 mr-2" />
                    {company.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <>
                <div className="p-2 border-b">
                  <Button variant="ghost" size="sm" onClick={handleBack} className="w-full justify-start">
                    ← {selectedCompany?.name}
                  </Button>
                </div>

                <CommandGroup heading="Users">
                  {companyUsers.map((user) => (
                    <CommandItem key={user.id} onSelect={() => handleSelectUser(user.id)}>
                      <User className="h-4 w-4 mr-2" />
                      <div className="flex-1">
                        <div className="text-sm">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                      {value?.userId === user.id && <Check className="h-4 w-4" />}
                    </CommandItem>
                  ))}
                </CommandGroup>

                <CommandGroup heading="Roles">
                  {companyRoles.map((role) => (
                    <CommandItem key={role.id} onSelect={() => handleSelectRole(role.id)}>
                      <Users className="h-4 w-4 mr-2" />
                      {role.name}
                      {value?.roleId === role.id && <Check className="h-4 w-4 ml-auto" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
