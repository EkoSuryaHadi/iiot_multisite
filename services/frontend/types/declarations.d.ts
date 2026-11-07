declare module "lucide-react";

declare module "next" {
  export type Metadata = Record<string, any>;
  export type NextConfig = Record<string, any>;
}

declare module "next/server" {
  export class NextResponse extends Response {
    static json(body: any, init?: ResponseInit): NextResponse;
    static next(): NextResponse;
    static redirect(url: string | URL, status?: number): NextResponse;
  }
  export type NextRequest = Request & {
    nextUrl: URL;
    cookies: any;
  };
}

declare module "next/link" {
  import React from "react";
  const Link: React.ComponentType<any>;
  export default Link;
}

declare module "next/image" {
  import React from "react";
  export type StaticImageData = {
    src: string;
    height: number;
    width: number;
    blurDataURL?: string;
  };
  const Image: React.ComponentType<any>;
  export default Image;
}

declare module "next/dynamic" {
  import React from "react";
  export default function dynamic(
    loader: () => Promise<any>,
    options?: { ssr?: boolean; loading?: () => React.ReactNode }
  ): React.ComponentType<any>;
}

declare module "next/headers" {
  export function cookies(): Promise<any>;
  export function headers(): Promise<any>;
}

declare module "next/font/google" {
  export function Outfit(options?: any): { className: string; variable: string };
  export function Inter(options?: any): { className: string; variable: string };
}

declare module "*.png" {
  const value: any;
  export default value;
}

declare module "*.jpg" {
  const value: any;
  export default value;
}

declare module "*.svg" {
  const value: any;
  export default value;
}

declare module "next/navigation" {
  export function useRouter(): {
    push(url: string): void;
    replace(url: string): void;
    back(): void;
    forward(): void;
    refresh(): void;
    prefetch(url: string): void;
  };
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams;
  export function useParams<T = Record<string, string | string[]>>(): T;
  export function redirect(url: string): never;
  export function notFound(): never;
}
