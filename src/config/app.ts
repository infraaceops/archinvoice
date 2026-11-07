const authProvider: string = 'firebase';

export const appConfig = {
  appName: 'ABS Invoice',
  appDomain: process.env.EXPO_PUBLIC_APP_DOMAIN || 'archinvoice.infraaceops.com',
  usernameAuthDomain: process.env.EXPO_PUBLIC_USERNAME_AUTH_DOMAIN || 'archinvoice.infraaceops.com',
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || '',
  authProvider,
  isCloudflareApiEnabled: Boolean(process.env.EXPO_PUBLIC_API_BASE_URL),
};

export const buildApiUrl = (path: string): string => {
  const base = (appConfig.apiBaseUrl || '').replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};
