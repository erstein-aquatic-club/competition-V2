import { toast } from "sonner"

/**
 * Toast notification presets for consistent styling and behavior across the app.
 * These presets ensure all notifications have uniform duration, styling, and accessibility.
 */

export const toastSuccess = (message: string, options?: { duration?: number }) => {
  return toast.success(message, {
    duration: options?.duration ?? 3000,
  })
}

export const toastError = (message: string, options?: { duration?: number }) => {
  return toast.error(message, {
    duration: options?.duration ?? 4000,
  })
}

export const toastInfo = (message: string, options?: { duration?: number }) => {
  return toast.info(message, {
    duration: options?.duration ?? 3000,
  })
}

export const toastWarning = (message: string, options?: { duration?: number }) => {
  return toast.warning(message, {
    duration: options?.duration ?? 3000,
  })
}

/**
 * Shows a loading toast that must be manually dismissed.
 * Returns the toast ID for later dismissal with toast.dismiss(id).
 */
export const toastLoading = (message: string) => {
  return toast.loading(message)
}

/**
 * Shows different toasts based on promise state.
 * Automatically dismisses loading toast when promise resolves/rejects.
 *
 * @example
 * toastPromise(
 *   saveData(),
 *   {
 *     loading: "Sauvegarde en cours...",
 *     success: "Données sauvegardées",
 *     error: "Erreur lors de la sauvegarde"
 *   }
 * )
 */
export const toastPromise = <T,>(
  promise: Promise<T>,
  messages: {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((error: any) => string)
  }
) => {
  return toast.promise(promise, messages)
}
