"use client";

import { useState } from "react";
import {
  Bell,
  Sparkles,
  Plus,
  LogOut,
  User,
  Settings as SettingsIcon,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandPalette } from "./command-palette";
import { NewVideoWizard } from "./new-video-wizard";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function DashboardTopbar() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [notifications] = useState([
    {
      id: 1,
      title: "Video published successfully",
      time: "2m ago",
      type: "success",
    },
    {
      id: 2,
      title: "AI script generation complete",
      time: "15m ago",
      type: "info",
    },
    {
      id: 3,
      title: "New trending topic detected",
      time: "1h ago",
      type: "warning",
    },
  ]);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    router.push("/auth/sign-in");
  };

  const userName = user?.email?.split("@")[0] || "User";
  const initials = userName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border/50 glass-strong px-4 md:px-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground hidden md:block">
          Welcome back,{" "}
          <span className="font-medium text-foreground">{userName}</span>
        </span>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <CommandPalette />

        <Button
          size="sm"
          className="hidden bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 sm:flex"
          onClick={() => setWizardOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New Video
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative flex h-9 w-9 items-center justify-center rounded-lg glass transition-colors hover:text-primary">
              <Bell className="h-4 w-4" />
              {notifications.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {notifications.length}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notifications
              <Badge variant="secondary" className="text-xs">
                {notifications.length} new
              </Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="flex items-start gap-3 py-3"
              >
                <div
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    n.type === "success"
                      ? "bg-success"
                      : n.type === "warning"
                      ? "bg-warning"
                      : "bg-info"
                  }`}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.time}</p>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-sm text-primary">
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* AI Copilot button */}
        <Button variant="outline" size="sm" className="hidden lg:flex">
          <Sparkles className="mr-1.5 h-4 w-4 text-primary" />
          AI Copilot
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg glass p-1 pr-2 transition-colors hover:text-primary">
              <Avatar className="h-7 w-7">
                <AvatarImage src="https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=150" />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:block">
                {userName}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push("/dashboard/settings")}
            >
              <User className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/dashboard/settings")}
            >
              <SettingsIcon className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/dashboard/settings")}
            >
              <CreditCard className="mr-2 h-4 w-4" /> Billing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Help &amp; Support</DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {wizardOpen && <NewVideoWizard onClose={() => setWizardOpen(false)} />}
    </header>
  );
}
