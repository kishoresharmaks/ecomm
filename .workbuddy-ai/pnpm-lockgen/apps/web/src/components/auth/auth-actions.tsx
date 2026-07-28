"use client";

import Link from "next/link";
import { SignInButton, SignOutButton, UserButton, useUser } from "@clerk/nextjs";
import { LogIn, LogOut } from "lucide-react";
import { Button } from "@indihub/ui";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export function AuthActions() {
  if (!clerkEnabled) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/sign-in">
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Sign in
        </Link>
      </Button>
    );
  }

  return <ClerkAuthActions />;
}

function ClerkAuthActions() {
  const { isSignedIn } = useUser();

  return (
    <div className="flex min-w-0 items-center gap-2">
      {!isSignedIn ? (
        <SignInButton mode="modal">
          <Button type="button" variant="outline" size="sm">
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Sign in
          </Button>
        </SignInButton>
      ) : null}
      {isSignedIn ? (
        <>
          <UserButton />
          <SignOutButton>
            <Button type="button" variant="ghost" size="sm">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </Button>
          </SignOutButton>
        </>
      ) : null}
    </div>
  );
}
