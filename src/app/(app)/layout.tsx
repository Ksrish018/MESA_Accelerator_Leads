import { ToastProvider } from "@/components/Toast";
import { TopBar } from "@/components/TopBar";
import { Wallpaper } from "@/components/Wallpaper";
import { TourProvider } from "@/components/Tour";
import { loadSettings } from "@/lib/thesis/load";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let completed = true;
  try {
    completed = !!(await loadSettings()).tour_completed_at;
  } catch {
    completed = true;
  }
  return (
    <ToastProvider>
      <TourProvider completed={completed}>
        <Wallpaper />
        <a href="#main" className="sr-only">Skip to content</a>
        <TopBar />
        <main id="main">{children}</main>
      </TourProvider>
    </ToastProvider>
  );
}
