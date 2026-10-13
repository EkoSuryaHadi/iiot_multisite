import type { UserRole } from "@/lib/types";
import {
  Activity,
  Building2,
  House,
  MapPin,
  Server,
  UsersRound,
} from "lucide-react";

export const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: House,
    },
    {
      title: "Tenants",
      url: "/tenants",
      icon: Building2,
      roles: ["superadmin"] as UserRole[],
    },
    {
      title: "Sites",
      url: "/sites",
      icon: MapPin,
    },
    {
      title: "Devices",
      url: "/devices",
      icon: Server,
    },
    {
      title: "Telemetry",
      url: "/telemetry",
      icon: Activity,
    },
    {
      title: "Users",
      url: "/users",
      icon: UsersRound,
      roles: ["superadmin", "tenant_admin"] as UserRole[],
    },
  ],
};
