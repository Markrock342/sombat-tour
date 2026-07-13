import { Platform } from 'react-native';
import { RefreshControl as NativeRefreshControl } from 'react-native';

/**
 * RN Web does not implement RefreshControl — use polyfill on web so pull-to-refresh
 * works in mobile browsers / PWA (425service.vercel.app).
 */
export const RefreshControl =
  Platform.OS === 'web'
    ? require('react-native-web-refresh-control').RefreshControl
    : NativeRefreshControl;

/** Default export — some screens import AppRefreshControl as default */
export default RefreshControl;
