import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const receipt = await prisma.orderReceipt.findFirst({
    where: { id, order: { organizationId: user.organizationId } },
    select: { fileName: true, contentType: true, content: true },
  });
  if (!receipt?.content) {
    return new Response("Receipt file was not found.", { status: 404 });
  }
  const fileName = (receipt.fileName || "receipt").replace(/["\r\n]/g, "");
  return new Response(Buffer.from(receipt.content), {
    headers: {
      "Content-Type": receipt.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
