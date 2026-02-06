import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "fishapp",
    path: "auth/callback",
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUri,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;

  if (!data?.url) {
    throw new Error("No OAuth URL returned");
  }

  const result = await WebBrowser.openAuthSessionAsync(
    data.url,
    redirectUri
  );

  if (result.type === "success") {
    const { url } = result;
    // Extract tokens from the URL fragment
    const { params } = QueryParams.getQueryParams(url);
    const { access_token, refresh_token } = params;

    if (access_token && refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (sessionError) throw sessionError;
    }
  }
}
