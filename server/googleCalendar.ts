// Google Calendar Integration - Standard OAuth 2.0 Implementation
// Multi-tenant: Each organization stores their own OAuth tokens

import { google, calendar_v3 } from 'googleapis';
import crypto from 'crypto';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
  email?: string;
}

interface StoredIntegration {
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}

function getOAuthConfig(): OAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth configuration missing. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables.');
  }

  return { clientId, clientSecret, redirectUri };
}

function createOAuth2Client(): InstanceType<typeof google.auth.OAuth2> {
  const config = getOAuthConfig();
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

// State parameter signing for CSRF protection
const STATE_SECRET = process.env.SESSION_SECRET || 'cassius-oauth-state-secret';

export function generateSignedState(organisationId: string): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = JSON.stringify({ organisationId, nonce, ts: Date.now() });
  const signature = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('hex');
  const state = Buffer.from(JSON.stringify({ payload, signature })).toString('base64url');
  return state;
}

export function verifySignedState(state: string): { organisationId: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
    const { payload, signature } = decoded;
    const expectedSignature = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('hex');
    
    if (signature !== expectedSignature) {
      console.error('State signature mismatch');
      return null;
    }
    
    const data = JSON.parse(payload);
    
    // Check state is not expired (15 minutes max)
    if (Date.now() - data.ts > 15 * 60 * 1000) {
      console.error('State expired');
      return null;
    }
    
    return { organisationId: data.organisationId };
  } catch (error) {
    console.error('Failed to verify state:', error);
    return null;
  }
}

export function generateAuthUrl(organisationId: string): string {
  const oauth2Client = createOAuth2Client();
  const state = generateSignedState(organisationId);
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state,
    prompt: 'consent', // Force consent to get refresh token
  });
}

export async function exchangeCodeForTokens(code: string): Promise<TokenData> {
  const oauth2Client = createOAuth2Client();
  
  const { tokens } = await oauth2Client.getToken(code);
  
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to obtain access and refresh tokens');
  }
  
  // Get user email
  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(tokens.expiry_date || Date.now() + 3600 * 1000),
    scope: tokens.scope || SCOPES.join(' '),
    email: userInfo.data.email || undefined,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  
  const { credentials } = await oauth2Client.refreshAccessToken();
  
  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token');
  }
  
  return {
    accessToken: credentials.access_token,
    expiresAt: new Date(credentials.expiry_date || Date.now() + 3600 * 1000),
  };
}

interface CalendarClientResult {
  client: calendar_v3.Calendar;
  refreshedTokens?: {
    accessToken: string;
    expiresAt: Date;
  };
}

export async function getGoogleCalendarClient(integration: StoredIntegration): Promise<CalendarClientResult> {
  if (!integration.accessToken || !integration.refreshToken) {
    throw new Error('Google Calendar not connected');
  }
  
  const oauth2Client = createOAuth2Client();
  
  // Check if token is expired or about to expire (5 min buffer)
  const needsRefresh = !integration.tokenExpiresAt || 
    new Date(integration.tokenExpiresAt).getTime() < Date.now() + 5 * 60 * 1000;
  
  let refreshedTokens: { accessToken: string; expiresAt: Date } | undefined;
  
  if (needsRefresh) {
    refreshedTokens = await refreshAccessToken(integration.refreshToken);
    oauth2Client.setCredentials({
      access_token: refreshedTokens.accessToken,
      refresh_token: integration.refreshToken,
    });
  } else {
    oauth2Client.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken,
    });
  }
  
  return {
    client: google.calendar({ version: 'v3', auth: oauth2Client }),
    refreshedTokens,
  };
}

export function isConfigured(): boolean {
  try {
    getOAuthConfig();
    return true;
  } catch {
    return false;
  }
}

export interface EnvCheckResult {
  hasGoogleClientId: boolean;
  hasGoogleClientSecret: boolean;
  hasGoogleRedirectUri: boolean;
  hasAppBaseUrl: boolean;
  hasStateSecret: boolean;
  expectedVariables: string[];
  missingVariables: string[];
}

export function checkEnvVariables(): EnvCheckResult {
  const expectedVariables = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET', 
    'GOOGLE_REDIRECT_URI',
    'APP_BASE_URL',
    'SESSION_SECRET',
  ];

  const hasGoogleClientId = !!process.env.GOOGLE_CLIENT_ID;
  const hasGoogleClientSecret = !!process.env.GOOGLE_CLIENT_SECRET;
  const hasGoogleRedirectUri = !!process.env.GOOGLE_REDIRECT_URI;
  const hasAppBaseUrl = !!process.env.APP_BASE_URL;
  const hasStateSecret = !!process.env.SESSION_SECRET;

  const missingVariables: string[] = [];
  if (!hasGoogleClientId) missingVariables.push('GOOGLE_CLIENT_ID');
  if (!hasGoogleClientSecret) missingVariables.push('GOOGLE_CLIENT_SECRET');
  if (!hasGoogleRedirectUri) missingVariables.push('GOOGLE_REDIRECT_URI');
  if (!hasAppBaseUrl) missingVariables.push('APP_BASE_URL');
  if (!hasStateSecret) missingVariables.push('SESSION_SECRET');

  return {
    hasGoogleClientId,
    hasGoogleClientSecret,
    hasGoogleRedirectUri,
    hasAppBaseUrl,
    hasStateSecret,
    expectedVariables,
    missingVariables,
  };
}

export async function getGoogleCalendarStatus(integration: StoredIntegration | null): Promise<{
  connected: boolean;
  configured: boolean;
  email?: string;
  error?: string;
}> {
  const configured = isConfigured();
  
  if (!configured) {
    return {
      connected: false,
      configured: false,
      error: 'Google OAuth non configuré. Définissez GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et GOOGLE_REDIRECT_URI.',
    };
  }
  
  if (!integration || !integration.accessToken || !integration.refreshToken) {
    return {
      connected: false,
      configured: true,
    };
  }
  
  try {
    const { client } = await getGoogleCalendarClient(integration);
    await client.settings.get({ setting: 'timezone' });
    
    return {
      connected: true,
      configured: true,
    };
  } catch (error: any) {
    return {
      connected: false,
      configured: true,
      error: error.message,
    };
  }
}

interface ListCalendarsResult {
  calendars: Array<{ id: string; summary: string; primary: boolean }>;
  refreshedTokens?: { accessToken: string; expiresAt: Date };
}

export async function listCalendars(integration: StoredIntegration): Promise<ListCalendarsResult> {
  const { client, refreshedTokens } = await getGoogleCalendarClient(integration);
  const response = await client.calendarList.list();
  
  return {
    calendars: (response.data.items || []).map(cal => ({
      id: cal.id || '',
      summary: cal.summary || 'Sans nom',
      primary: cal.primary || false,
    })),
    refreshedTokens,
  };
}

export interface CreateEventParams {
  calendarId: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  cassiusAppointmentId: string;
}

interface CreateEventResult {
  eventId: string;
  etag: string;
  refreshedTokens?: { accessToken: string; expiresAt: Date };
}

export async function createCalendarEvent(integration: StoredIntegration, params: CreateEventParams): Promise<CreateEventResult> {
  const { client, refreshedTokens } = await getGoogleCalendarClient(integration);
  
  const event: calendar_v3.Schema$Event = {
    summary: params.summary,
    description: params.description,
    start: {
      dateTime: params.start.toISOString(),
      timeZone: 'Europe/Paris',
    },
    end: {
      dateTime: params.end.toISOString(),
      timeZone: 'Europe/Paris',
    },
    extendedProperties: {
      private: {
        cassiusAppointmentId: params.cassiusAppointmentId,
      },
    },
  };

  const response = await client.events.insert({
    calendarId: params.calendarId,
    requestBody: event,
  });

  return {
    eventId: response.data.id || '',
    etag: response.data.etag || '',
    refreshedTokens,
  };
}

export interface UpdateEventParams {
  calendarId: string;
  eventId: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  cassiusAppointmentId: string;
}

interface UpdateEventResult {
  etag: string;
  refreshedTokens?: { accessToken: string; expiresAt: Date };
}

export async function updateCalendarEvent(integration: StoredIntegration, params: UpdateEventParams): Promise<UpdateEventResult> {
  const { client, refreshedTokens } = await getGoogleCalendarClient(integration);
  
  const event: calendar_v3.Schema$Event = {
    summary: params.summary,
    description: params.description,
    start: {
      dateTime: params.start.toISOString(),
      timeZone: 'Europe/Paris',
    },
    end: {
      dateTime: params.end.toISOString(),
      timeZone: 'Europe/Paris',
    },
    extendedProperties: {
      private: {
        cassiusAppointmentId: params.cassiusAppointmentId,
      },
    },
  };

  const response = await client.events.update({
    calendarId: params.calendarId,
    eventId: params.eventId,
    requestBody: event,
  });

  return {
    etag: response.data.etag || '',
    refreshedTokens,
  };
}

interface DeleteEventResult {
  refreshedTokens?: { accessToken: string; expiresAt: Date };
}

export async function deleteCalendarEvent(integration: StoredIntegration, calendarId: string, eventId: string): Promise<DeleteEventResult> {
  const { client, refreshedTokens } = await getGoogleCalendarClient(integration);
  
  try {
    await client.events.delete({
      calendarId,
      eventId,
    });
  } catch (error: any) {
    if (error.code !== 404) {
      throw error;
    }
  }
  
  return { refreshedTokens };
}

interface GetEventResult {
  event: calendar_v3.Schema$Event | null;
  refreshedTokens?: { accessToken: string; expiresAt: Date };
}

export async function getCalendarEvent(integration: StoredIntegration, calendarId: string, eventId: string): Promise<GetEventResult> {
  const { client, refreshedTokens } = await getGoogleCalendarClient(integration);
  
  try {
    const response = await client.events.get({
      calendarId,
      eventId,
    });
    return { event: response.data, refreshedTokens };
  } catch (error: any) {
    if (error.code === 404) {
      return { event: null, refreshedTokens };
    }
    throw error;
  }
}
