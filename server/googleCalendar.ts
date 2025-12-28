// Google Calendar Integration - Replit Connector
// Uses the Replit connector for secure OAuth token management

import { google, calendar_v3 } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  return accessToken;
}

export async function getGoogleCalendarClient(): Promise<calendar_v3.Calendar> {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function isGoogleCalendarConnected(): Promise<boolean> {
  try {
    await getAccessToken();
    return true;
  } catch {
    return false;
  }
}

export async function getGoogleCalendarStatus(): Promise<{
  connected: boolean;
  email?: string;
  error?: string;
}> {
  try {
    const client = await getGoogleCalendarClient();
    const settings = await client.settings.get({ setting: 'timezone' });
    
    // Try to get user email from connection settings
    const email = connectionSettings?.settings?.email || connectionSettings?.settings?.oauth?.email;
    
    return {
      connected: true,
      email: email || undefined,
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error.message,
    };
  }
}

export async function listCalendars(): Promise<Array<{ id: string; summary: string; primary: boolean }>> {
  const client = await getGoogleCalendarClient();
  const response = await client.calendarList.list();
  
  return (response.data.items || []).map(cal => ({
    id: cal.id || '',
    summary: cal.summary || 'Sans nom',
    primary: cal.primary || false,
  }));
}

export interface CreateEventParams {
  calendarId: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  cassiusAppointmentId: string;
}

export async function createCalendarEvent(params: CreateEventParams): Promise<{ eventId: string; etag: string }> {
  const client = await getGoogleCalendarClient();
  
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

export async function updateCalendarEvent(params: UpdateEventParams): Promise<{ etag: string }> {
  const client = await getGoogleCalendarClient();
  
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
  };
}

export async function deleteCalendarEvent(calendarId: string, eventId: string): Promise<void> {
  const client = await getGoogleCalendarClient();
  
  try {
    await client.events.delete({
      calendarId,
      eventId,
    });
  } catch (error: any) {
    // If event already deleted (404), ignore
    if (error.code !== 404) {
      throw error;
    }
  }
}

export async function getCalendarEvent(calendarId: string, eventId: string): Promise<calendar_v3.Schema$Event | null> {
  const client = await getGoogleCalendarClient();
  
  try {
    const response = await client.events.get({
      calendarId,
      eventId,
    });
    return response.data;
  } catch (error: any) {
    if (error.code === 404) {
      return null;
    }
    throw error;
  }
}
