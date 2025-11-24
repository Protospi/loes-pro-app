import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

export class GoogleCalendarService {
  private calendar: any;
  private auth: JWT | OAuth2Client;
  private useOAuth: boolean;

  constructor(useOAuth: boolean = true) {
    this.useOAuth = useOAuth;
    
    if (useOAuth) {
      // Validate required OAuth environment variables
      if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
        throw new Error(`
          ❌ Missing Google OAuth credentials!
          
          Please set up your .env file with:
          GOOGLE_OAUTH_CLIENT_ID=your_client_id_here
          GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret_here
          GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3009/auth/callback
          GOOGLE_OAUTH_REFRESH_TOKEN=your_refresh_token_here
          
          Follow the setup guide in CALENDAR_SETUP.md
        `);
      }

      // Initialize OAuth2 client for user calendar access
      this.auth = new OAuth2Client({
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3009/auth/callback'
      });
      
      // Set credentials if refresh token is available
      if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
        this.auth.setCredentials({
          refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN
        });
      } else {
        console.log(`
          ⚠️  No refresh token found!
          
          To complete OAuth setup:
          1. Visit: http://localhost:3009/api/auth/google
          2. Follow the authorization flow
          3. Add the refresh token to your .env file
        `);
      }
    } else {
      // Initialize the JWT auth with service account credentials (fallback)
      this.auth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        scopes: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events'
        ]
      });
    }

    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  /**
   * Get OAuth2 authorization URL for initial setup
   */
  getAuthUrl(): string {
    if (!this.useOAuth || !(this.auth instanceof OAuth2Client)) {
      throw new Error('OAuth2 not configured');
    }

    const authUrl = this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      prompt: 'consent' // Force consent to get refresh token
    });

    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   */
  async setAuthCode(code: string): Promise<void> {
    if (!this.useOAuth || !(this.auth instanceof OAuth2Client)) {
      throw new Error('OAuth2 not configured');
    }

    const { tokens } = await this.auth.getToken(code);
    this.auth.setCredentials(tokens);
    
    console.log('Refresh Token:', tokens.refresh_token);
    console.log('Please add this to your .env file as GOOGLE_OAUTH_REFRESH_TOKEN');
  }

  /**
   * Ensure we have a valid access token, refresh if necessary
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.useOAuth || !(this.auth instanceof OAuth2Client)) {
      return; // Service account doesn't need token refresh
    }

    try {
      // Check if we have credentials
      const credentials = this.auth.credentials;
      if (!credentials.refresh_token) {
        throw new Error('No refresh token available. Please complete OAuth setup first by visiting: http://localhost:3009/api/auth/google');
      }

      // Check if access token is expired or about to expire
      const now = Date.now();
      const expiryDate = credentials.expiry_date;
      
      if (!credentials.access_token || (expiryDate && expiryDate <= now + 60000)) {
        console.log('🔄 Refreshing access token...');
        const { credentials: newCredentials } = await this.auth.refreshAccessToken();
        this.auth.setCredentials(newCredentials);
        console.log('✅ Access token refreshed successfully');
      }
    } catch (error: any) {
      console.error('❌ Token refresh failed:', error);
      
      // Provide specific guidance for common errors
      if (error.message?.includes('invalid_grant')) {
        throw new Error(`
🔴 TOKEN EXPIRED OR REVOKED!

Your Google OAuth refresh token is no longer valid. This happens when:
- Token hasn't been used for 6 months
- Your OAuth app is in "Testing" mode (tokens expire after 7 days)
- Google account password was changed
- App access was revoked

🔧 TO FIX:
1. Visit: http://localhost:3009/api/auth/google
2. Follow the authorization flow
3. Copy the new refresh token to your .env file
4. Restart the server

💡 TO MAKE IT PERMANENT:
- Publish your OAuth consent screen in Google Cloud Console
- Set OAuth app to "Production" (not "Testing")
- This prevents tokens from expiring
        `);
      }
      
      throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please re-authorize your application at http://localhost:3009/api/auth/google`);
    }
  }

  /**
   * Schedule a new meeting/event in Google Calendar
   */
  async scheduleMeeting(params: {
    title: string;
    description?: string;
    startDateTime: string; // ISO 8601 format
    endDateTime: string; // ISO 8601 format
    attendeeEmails?: string[];
    location?: string;
    calendarId?: string;
  }): Promise<string> {
    try {
      // Ensure we have a valid token before making API calls
      await this.ensureValidToken();
      const {
        title,
        description = '',
        startDateTime,
        endDateTime,
        attendeeEmails = [],
        location = '',
        calendarId = 'primary'
      } = params;

      // For service accounts, we can't invite attendees without domain delegation
      // So we'll create the event without attendees and provide alternative instructions
      const attendees = this.useOAuth ? attendeeEmails.map(email => ({ email })) : [];
      
      // Create the event
      const event = {
        summary: title,
        description: this.useOAuth 
          ? description 
          : `${description}\n\n📧 Attendees to invite manually: ${attendeeEmails.join(', ')}`,
        location,
        start: {
          dateTime: startDateTime,
          timeZone: 'America/Sao_Paulo', // Adjust timezone as needed
        },
        end: {
          dateTime: endDateTime,
          timeZone: 'America/Sao_Paulo',
        },
        attendees,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 30 }, // 30 minutes before
          ],
        },
      };

      const response = await this.calendar.events.insert({
        calendarId,
        resource: event,
        conferenceDataVersion: 1,
        sendUpdates: this.useOAuth && attendees.length > 0 ? 'all' : 'none'
      });

      const eventId = response.data.id;
      const eventLink = response.data.htmlLink;
      const meetLink = response.data.conferenceData?.entryPoints?.[0]?.uri || 'No meet link generated';

      let resultMessage = `✅ Meeting scheduled successfully!
📅 Event ID: ${eventId}
🔗 Calendar Link: ${eventLink}
📹 Meet Link: ${meetLink}`;

      if (this.useOAuth && attendeeEmails.length > 0) {
        resultMessage += `\n📧 Invitations sent to: ${attendeeEmails.join(', ')}`;
      } else if (!this.useOAuth && attendeeEmails.length > 0) {
        resultMessage += `\n📧 Please manually invite: ${attendeeEmails.join(', ')}`;
        resultMessage += `\n💡 Share this calendar link with attendees: ${eventLink}`;
      }

      return resultMessage;

    } catch (error) {
      console.error('Error scheduling meeting:', error);
      return `❌ Error scheduling meeting: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Get upcoming events from calendar
   */
  async getUpcomingEvents(params: {
    maxResults?: number;
    calendarId?: string;
    timeMin?: string;
    timeMax?: string;
  }): Promise<string> {
    try {
      // Ensure we have a valid token before making API calls
      await this.ensureValidToken();
      const {
        maxResults = 10,
        calendarId = 'primary',
        timeMin = new Date().toISOString(),
        timeMax
      } = params;

      const response = await this.calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];

      if (events.length === 0) {
        return '📅 No upcoming events found.';
      }

      let result = `📅 Upcoming Events (${events.length}):\n\n`;

      events.forEach((event: any, index: number) => {
        const start = event.start?.dateTime || event.start?.date;
        const end = event.end?.dateTime || event.end?.date;
        const startFormatted = new Date(start).toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo'
        });
        const endFormatted = new Date(end).toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo'
        });

        result += `${index + 1}. 📝 ${event.summary || 'No title'}\n`;
        result += `   ⏰ ${startFormatted} - ${endFormatted}\n`;
        if (event.location) result += `   📍 ${event.location}\n`;
        if (event.description) result += `   📄 ${event.description}\n`;
        if (event.htmlLink) result += `   🔗 ${event.htmlLink}\n`;
        result += '\n';
      });

      return result;

    } catch (error) {
      console.error('Error getting events:', error);
      return `❌ Error getting events: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Find available time slots for scheduling
   */
  async findAvailableSlots(params: {
    date: string; // YYYY-MM-DD format
    duration: number; // duration in minutes
    workingHoursStart?: string; // HH:MM format
    workingHoursEnd?: string; // HH:MM format
    calendarId?: string;
  }): Promise<string> {
    try {
      // Ensure we have a valid token before making API calls
      await this.ensureValidToken();
      const {
        date,
        duration,
        workingHoursStart = '09:00',
        workingHoursEnd = '18:00',
        calendarId = 'primary'
      } = params;

      // Get events for the specified date
      const timeMin = new Date(`${date}T${workingHoursStart}:00-03:00`).toISOString();
      const timeMax = new Date(`${date}T${workingHoursEnd}:00-03:00`).toISOString();

      const response = await this.calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      const availableSlots: string[] = [];

      // Convert working hours to minutes
      const [startHour, startMin] = workingHoursStart.split(':').map(Number);
      const [endHour, endMin] = workingHoursEnd.split(':').map(Number);
      const workStart = startHour * 60 + startMin;
      const workEnd = endHour * 60 + endMin;

      // Find gaps between events
      let currentTime = workStart;

      events.forEach((event: any) => {
        const eventStart = new Date(event.start?.dateTime || event.start?.date);
        const eventEnd = new Date(event.end?.dateTime || event.end?.date);
        
        const eventStartMin = eventStart.getHours() * 60 + eventStart.getMinutes();
        const eventEndMin = eventEnd.getHours() * 60 + eventEnd.getMinutes();

        // Add all possible slots in the gap before this event
        while (currentTime + duration <= eventStartMin) {
          const slotStart = Math.floor(currentTime / 60).toString().padStart(2, '0') + ':' + 
                           (currentTime % 60).toString().padStart(2, '0');
          const slotEnd = Math.floor((currentTime + duration) / 60).toString().padStart(2, '0') + ':' + 
                         ((currentTime + duration) % 60).toString().padStart(2, '0');
          availableSlots.push(`${slotStart} - ${slotEnd}`);
          currentTime += duration; // Move to the next slot
        }

        currentTime = Math.max(currentTime, eventEndMin);
      });

      // Add all possible slots after the last event
      while (currentTime + duration <= workEnd) {
        const slotStart = Math.floor(currentTime / 60).toString().padStart(2, '0') + ':' + 
                         (currentTime % 60).toString().padStart(2, '0');
        const slotEnd = Math.floor((currentTime + duration) / 60).toString().padStart(2, '0') + ':' + 
                       ((currentTime + duration) % 60).toString().padStart(2, '0');
        availableSlots.push(`${slotStart} - ${slotEnd}`);
        currentTime += duration; // Move to the next slot
      }

      if (availableSlots.length === 0) {
        return `❌ No available slots found for ${date} (${duration} minutes duration)`;
      }

      let result = `🕐 Available time slots for ${date} (${duration} minutes each):\n\n`;
      availableSlots.forEach((slot, index) => {
        result += `${index + 1}. ${slot}\n`;
      });

      return result;

    } catch (error) {
      console.error('Error finding available slots:', error);
      return `❌ Error finding available slots: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Cancel/delete an event
   */
  async cancelMeeting(params: {
    eventId: string;
    calendarId?: string;
    sendUpdates?: boolean;
  }): Promise<string> {
    try {
      // Ensure we have a valid token before making API calls
      await this.ensureValidToken();
      const {
        eventId,
        calendarId = 'primary',
        sendUpdates = true
      } = params;

      await this.calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates: sendUpdates ? 'all' : 'none'
      });

      return `✅ Meeting cancelled successfully! Event ID: ${eventId}`;

    } catch (error) {
      console.error('Error cancelling meeting:', error);
      return `❌ Error cancelling meeting: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}
