import { Component, ReactNode } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  isChunkError: boolean
}

/**
 * ErrorBoundary catches React errors and displays a friendly error UI
 * with a retry button. Handles both regular React errors and chunk loading failures
 * (which can happen after deployments when cached code references old chunks).
 *
 * Wrap the App component with this to catch all React errors.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, isChunkError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Detect chunk loading errors (common after deployments)
    const isChunkError = /loading.*(chunk|module)|failed to fetch/i.test(error.message)
    return { hasError: true, error, isChunkError }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log to console in development
    if (import.meta.env.DEV) {
      console.error("ErrorBoundary caught an error:", error, errorInfo)
    }

    // In production, you might want to log to an error tracking service
    // like Sentry, LogRocket, etc.
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    // Reload the page to reset state
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {this.state.isChunkError
                  ? "Mise à jour disponible"
                  : "Une erreur est survenue"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {this.state.isChunkError
                  ? "L'application a été mise à jour. Rechargez la page pour continuer."
                  : "L'application a rencontré un problème inattendu."}
                <br />
                {!this.state.isChunkError && "Veuillez réessayer ou actualiser la page."}
              </p>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <details className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-left">
                <summary className="cursor-pointer text-sm font-medium text-destructive">
                  Détails de l'erreur (dev only)
                </summary>
                <pre className="mt-2 overflow-auto text-xs text-muted-foreground">
                  {this.state.error.toString()}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={this.handleReset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Réessayer
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.href = "/"}
              >
                Retour à l'accueil
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
