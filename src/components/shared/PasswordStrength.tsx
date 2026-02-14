import { CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface PasswordStrengthProps {
  password: string
}

interface StrengthCheck {
  label: string
  test: (password: string) => boolean
}

const strengthChecks: StrengthCheck[] = [
  { label: "Au moins 8 caractères", test: (pwd) => pwd.length >= 8 },
  { label: "Une majuscule", test: (pwd) => /[A-Z]/.test(pwd) },
  { label: "Un chiffre", test: (pwd) => /[0-9]/.test(pwd) },
]

/**
 * Visual password strength indicator with validation criteria.
 * Shows real-time feedback as user types.
 *
 * @example
 * <PasswordStrength password={passwordValue} />
 */
export function PasswordStrength({ password }: PasswordStrengthProps) {
  const passedChecks = strengthChecks.filter((check) => check.test(password))
  const strength = passedChecks.length
  const strengthLabel = strength === 0 ? "Faible" : strength === 1 ? "Faible" : strength === 2 ? "Moyen" : "Fort"
  const strengthColor = strength === 0 ? "bg-destructive" : strength === 1 ? "bg-destructive" : strength === 2 ? "bg-orange-500" : "bg-status-success"

  if (!password) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all duration-300", strengthColor)}
            style={{ width: `${(strength / strengthChecks.length) * 100}%` }}
          />
        </div>
        <span className={cn("text-xs font-medium", strengthColor.replace("bg-", "text-"))}>
          {strengthLabel}
        </span>
      </div>

      <div className="space-y-1">
        {strengthChecks.map((check, index) => {
          const passed = check.test(password)
          return (
            <div key={index} className="flex items-center gap-2 text-xs">
              {passed ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-status-success shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <span className={cn(passed ? "text-foreground" : "text-muted-foreground")}>
                {check.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
