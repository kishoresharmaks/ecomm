import { useAuth } from "@clerk/clerk-expo";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { LoadingState } from "../src/components/screen";

WebBrowser.maybeCompleteAuthSession();

export default function SsoCallbackScreen() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    router.replace(isSignedIn ? "/" : "/auth/sign-in");
  }, [isLoaded, isSignedIn]);

  return <LoadingState message="Completing seller sign in..." />;
}
