/**
 * Touch feedback. Deliberately sparse: a tick when a choice lands, a thud when
 * something fails. Buzzing on every tap is noise, not feedback.
 *
 * Every call is fire-and-forget — haptics are unavailable on web and on some
 * Android hardware, and a missing vibration must never surface as an error.
 */
import * as Haptics from 'expo-haptics';

export function tapFeedback(): void {
  void Haptics.selectionAsync().catch(() => undefined);
}

export function successFeedback(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function warningFeedback(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
}

export function errorFeedback(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
}
