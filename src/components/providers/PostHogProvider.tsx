"use client";

import { useEffect } from "react";
import Script from "next/script";
import { useUser } from "@clerk/nextjs";
import { identifyUser } from "@/lib/posthog-client";

/**
 * PostHogProvider — lazy-loads the PostHog browser snippet + identifies
 * the signed-in user automatically.
 *
 * Mounts under the dashboard layout so marketing pages don't pay the
 * bundle cost. No-ops when NEXT_PUBLIC_POSTHOG_KEY is missing (dev or
 * opted-out deploys).
 *
 * Privacy: only identifies after the user is signed in. Anonymous
 * events still flow but aren't linked to a user ID.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { user, isSignedIn } = useUser();
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

  useEffect(() => {
    if (isSignedIn && user?.id) {
      identifyUser(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
      });
    }
  }, [isSignedIn, user?.id, user?.primaryEmailAddress?.emailAddress, user?.fullName]);

  if (!key) return <>{children}</>;

  return (
    <>
      <Script id="posthog-snippet" strategy="afterInteractive">
        {`
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('${key}', { api_host: '${host}', person_profiles: 'identified_only' });
        `}
      </Script>
      {children}
    </>
  );
}
