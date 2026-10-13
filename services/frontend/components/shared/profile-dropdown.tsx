import Logout from "@/components/auth/logout";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import userImg from "@/public/assets/images/user.png";
import { useSession } from "next-auth/react";
import Image from "next/image";

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Superadmin",
  tenant_admin: "Tenant Admin",
  operator: "Operator",
  viewer: "Viewer",
};

const ProfileDropdown = () => {
  const { data: session } = useSession();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "rounded-full sm:w-10 sm:h-10 w-8 h-8 bg-gray-200/75 hover:bg-slate-200 focus-visible:ring-0 dark:bg-slate-700 dark:hover:bg-slate-600 border-0 cursor-pointer data-[state=open]:bg-gray-300 data-[state=open]:ring-4 data-[state=open]:ring-slate-300 dark:data-[state=open]:ring-slate-500 dark:data-[state=open]:bg-slate-600"
          )}
        >
          <Image
            src={userImg}
            className="rounded-full"
            width={40}
            height={40}
            alt={"User profile"}
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="sm:w-[300px] min-w-[250px] right-[40px] absolute p-4 rounded-2xl overflow-hidden shadow-lg"
        side="bottom"
        align="end"
      >
        <div className="py-3 px-4 rounded-lg bg-primary/10 dark:bg-primar flex items-center justify-between">
          <div className="overflow-hidden">
            <h6 className="text-base text-neutral-900 dark:text-white font-semibold mb-0 truncate">
              {session?.user?.email ?? "-"}
            </h6>
            <span className="text-sm text-neutral-500 dark:text-neutral-300">
              {session?.user?.role ? ROLE_LABEL[session.user.role] ?? session.user.role : ""}
            </span>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto scroll-sm pt-4">
          <ul className="flex flex-col gap-3">
            <li>
              <Logout />
            </li>
          </ul>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileDropdown;
