import type { UserRole } from "@/lib/types";
import {
  Activity,
  Building2,
  FileSpreadsheet,
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
      title: "Group Utama (Tenant)",
      url: "/tenants",
      icon: Building2,
      roles: ["superadmin"] as UserRole[],
    },
    {
      title: "Child Node (Site)",
      url: "/sites",
      icon: MapPin,
    },
    {
      title: "Devices / Sensor",
      url: "/devices",
      icon: Server,
    },
    {
      title: "Telemetry",
      url: "/telemetry",
      icon: Activity,
    },
    {
      title: "Efficiency Sharing",
      url: "/reports/efficiency-sharing",
      icon: FileSpreadsheet,
    },
    {
      title: "Users",
      url: "/users",
      icon: UsersRound,
      roles: ["superadmin", "tenant_admin"] as UserRole[],
    },
  ],
};
