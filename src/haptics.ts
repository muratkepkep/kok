import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

// Titreşim desteklenmeyen cihazlarda sessizce geçilir.
const quiet = (action: Promise<void>) => void action.catch(() => undefined)

export const tapLight = () => quiet(Haptics.impact({ style: ImpactStyle.Light }))
export const tapFirm = () => quiet(Haptics.impact({ style: ImpactStyle.Medium }))
export const tapSuccess = () => quiet(Haptics.notification({ type: NotificationType.Success }))
