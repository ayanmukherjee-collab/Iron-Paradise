import { getDeskCode } from "@/attendance/queries";
import { databaseErrorMessage } from "@/auth/guarded-action";
import { takeRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const switchedOff =
  "This desk link is switched off. Ask the owner for a new one.";

// Public: the desk device has no account. The token in the path is the
// credential, checked in the database; see private.desk_checkin_code.
export async function GET(
  request: Request,
  { params }: RouteContext<"/desk/[token]/code">,
) {
  const { token } = await params;
  if (!tokenPattern.test(token)) return reply({ error: switchedOff }, 404);

  if (!(await takeRateLimit("deskDisplay", clientIp(request.headers)))) {
    return reply({ error: "Too many requests. Wait a minute." }, 429);
  }

  try {
    return reply(await getDeskCode(token), 200);
  } catch (error) {
    const message = databaseErrorMessage(error);
    if (message) return reply({ error: message }, 404);
    throw error;
  }
}

function reply(body: object, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
