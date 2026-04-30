import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

export function configurePassport() {
  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    passport.use(
      new DiscordStrategy(
        {
          clientID: process.env.DISCORD_CLIENT_ID,
          clientSecret: process.env.DISCORD_CLIENT_SECRET,
          callbackURL: process.env.DISCORD_CALLBACK_URL || 'http://localhost:3000/api/auth/discord/callback',
          scope: ['identify', 'email'],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            // TODO: Find or create user in database using profile.id
            // For now, pass the profile through
            done(null, {
              discordId: profile.id,
              displayName: profile.username,
              avatarUrl: profile.avatar
                ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                : null,
            });
          } catch (err) {
            done(err as Error);
          }
        },
      ),
    );
  }

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            // TODO: Find or create user in database using profile.id
            done(null, {
              googleId: profile.id,
              displayName: profile.displayName,
              avatarUrl: profile.photos?.[0]?.value || null,
            });
          } catch (err) {
            done(err as Error);
          }
        },
      ),
    );
  }

  return passport;
}
