import { checkInUrl } from "@/attendance/code";
import { getCheckInSetup } from "@/attendance/queries";
import { printedQrPdf } from "@/attendance/qr-pdf";
import { getViewer, viewerCan } from "@/auth/session";
import { gym } from "@/content/landing";
import { formatDate, todayAtGym } from "@/lib/dates";
import { publicEnv } from "@/lib/env";

// A file download, so a Route Handler rather than a page. It repeats the
// session and permission checks the setup page makes.
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return new Response("Sign in required", { status: 401 });
  if (!viewerCan(viewer, "desk.manage")) {
    return new Response("You don't have access to check-in setup", {
      status: 403,
    });
  }

  const setup = await getCheckInSetup(viewer);
  if (!setup.printedQrEnabled) {
    return new Response(
      "The printed QR is switched off. Switch it on to download it.",
      { status: 409 },
    );
  }

  const pdf = printedQrPdf({
    url: checkInUrl(setup.printedCode, publicEnv().NEXT_PUBLIC_SITE_URL),
    gymName: gym.name,
    madeOn: formatDate(todayAtGym()),
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'attachment; filename="iron-paradise-check-in-qr.pdf"',
      // The code lets anyone check in: never kept by a shared cache.
      "Cache-Control": "private, no-store",
    },
  });
}
