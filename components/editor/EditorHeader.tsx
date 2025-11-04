"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/auth-client";
import { signOutUser } from "@/lib/auth-helpers";
import { GithubLogo } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface EditorHeaderProps {
  className?: string;
}

export function EditorHeader({ className }: EditorHeaderProps) {
  const { data: session } = useSession();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOutUser();
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const getUserInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl",
        "supports-[backdrop-filter]:bg-background/70",
        className
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-4">
          <SidebarTrigger className="transition-opacity hover:opacity-80" />
          
          <Link href="/" className="flex items-center transition-opacity hover:opacity-80">
            <Image 
              src="/logo.png" 
              alt="Stage" 
              width={32} 
              height={32}
              className="h-8 w-8"
            />
          </Link>

          <div className="flex-1" />

          <div className="flex items-center gap-2 sm:gap-4">
            <a
              href="https://github.com/KartikLabhshetwar/stage"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "p-2 rounded-lg transition-colors",
                "hover:bg-accent text-muted-foreground hover:text-foreground"
              )}
              aria-label="GitHub repository"
            >
              <GithubLogo className="h-5 w-5" />
            </a>
            
            {session?.user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className={cn(
                      "outline-none rounded-full transition-opacity",
                      "hover:opacity-80 focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    )}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage 
                        src={session.user.image || undefined} 
                        alt={session.user.name || session.user.email} 
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getUserInitials(session.user.name, session.user.email)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {session.user.name || "User"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {session.user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuItem 
                    onClick={() => router.push("/designs")}
                    className="cursor-pointer"
                  >
                    My Designs
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    variant="destructive"
                    onClick={handleSignOut}
                    className="cursor-pointer"
                  >
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link href="/sign-in">
                  <Button variant="ghost" className="hidden sm:inline-flex">
                    Sign In
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

