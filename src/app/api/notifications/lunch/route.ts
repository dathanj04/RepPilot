import { getCurrentUser } from "@/lib/auth";
import {hasBusinessFeatures} from "@/lib/domain/paid-access";
import { prisma } from "@/lib/db";
export async function GET() {
  const user = await getCurrentUser();
  if(!hasBusinessFeatures(user))return Response.json({lunches:[]},{headers:{"Cache-Control":"private, no-store"}});
  const lunches = await prisma.lunchBooking.findMany({where:{organizationId:user.organizationId,representativeId:user.id,status:"AWAITING_APPROVAL"},select:{id:true,slotStartsAt:true,account:{select:{name:true}}},orderBy:{updatedAt:"desc"},take:20});
  return Response.json({lunches:lunches.map(lunch=>({id:lunch.id,name:lunch.account.name,startsAt:lunch.slotStartsAt.toISOString()}))},{headers:{"Cache-Control":"private, no-store"}});
}
